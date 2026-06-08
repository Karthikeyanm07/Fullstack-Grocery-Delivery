import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import {
	AUTH_TOKEN_EXPIRY,
	PARTNER_LOGIN_MAX_ATTEMPTS,
	PARTNER_LOGIN_WINDOW_MS,
} from "../utils/authConstants.js";
import { checkRateLimit } from "../utils/rateLimiter.js";
import { DUMMY_HASH, getParamId, normalizeEmail } from "../utils/helper.js";
import { OrderStatus, Prisma } from "../generated/prisma/client.js";
import { clearPartnerCookie, sendPartnerCookie } from "../utils/authCookie.js";
import {
	ACTIVE_DELIVERY_STATUSES,
	appendStatusHistory,
	canTransitionOrderStatus,
	isTerminalOrderStatus,
} from "../utils/order.js";
import { getClientIP, sendInvalidId } from "../utils/request.js";

// * ─── Helpers ──────────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
	throw new Error(
		"JWT_SECRET environment variable must be set and at least 32 characters long.",
	);
}
const generatePartnerToken = (id: string): string =>
	jwt.sign({ id, role: "delivery" }, JWT_SECRET, {
		expiresIn: AUTH_TOKEN_EXPIRY,
	});

// Build a safe partner object — strips password before any response
const safePartner = (partner: { password: string; [key: string]: unknown }) => {
	const { password: _pw, ...rest } = partner;
	return rest;
};

// * ─── POST api/delivery/login ───────────────────────────────────────────────
export const loginPartner = async (req: Request, res: Response) => {
	try {
		const rateLimit = await checkRateLimit({
			key: `partner-login:${getClientIP(req)}`,
			maxAttempts: PARTNER_LOGIN_MAX_ATTEMPTS,
			windowMS: PARTNER_LOGIN_WINDOW_MS,
		});
		if (!rateLimit.allowed) {
			return res.status(429).json({
				success: false,
				code: "TOO_MANY_REQUESTS",
				message: `Too many login attempts. Try again in ${Math.ceil(rateLimit.retryAfterMS / 1000)} seconds.`,
			});
		}

		const { email, password } = req.body as Record<string, unknown>;

		if (
			!email ||
			!password ||
			typeof email !== "string" ||
			typeof password !== "string"
		) {
			return res.status(400).json({
				success: false,
				code: "MISSING_FIELDS",
				message: "Please provide email and password.",
			});
		}

		const normalizedEmail = normalizeEmail(email);
		if (!normalizedEmail) {
			return res.status(400).json({
				success: false,
				code: "INVALID_EMAIL",
				message: "Please provide a valid email address",
			});
		}

		const partner = await prisma.deliveryPartner.findUnique({
			where: { email: normalizedEmail },
		});

		const isMatch = await bcrypt.compare(
			password,
			partner?.password ?? DUMMY_HASH,
		);

		if (!partner || !isMatch) {
			return res.status(401).json({
				success: false,
				code: "INVALID_CREDENTIALS",
				message: "Invalid email or password.",
			});
		}

		if (!partner.isActive) {
			return res.status(403).json({
				success: false,
				code: "ACCOUNT_DEACTIVATED",
				message:
					"Your account has been deactivated. Please contact support.",
			});
		}

		const token = generatePartnerToken(partner.id);
		sendPartnerCookie(res, token);

		return res.status(200).json({
			success: true,
			message: "Login successful.",
			data: { partner: safePartner(partner) },
		});
	} catch (error) {
		console.error("[loginPartner]", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Login failed. Please try again.",
		});
	}
};

// * ─── POST /api/delivery/logout ─────────────────────────────────────────────
export const logoutPartner = (_req: Request, res: Response) => {
	clearPartnerCookie(res);
	return res.status(200).json({
		success: true,
		message: "Logged out successfully.",
	});
};

// * ─── GET api/delivery/my-deliveries ─────────────────────────────────────────
export const getMyDeliveries = async (req: Request, res: Response) => {
	try {
		const { status } = req.query;

		const where: Prisma.OrderWhereInput = {
			deliveryPartnerId: req.partner!.id,
		};

		if (status === "active") {
			where.status = {
				in: [
					OrderStatus.Confirmed,
					OrderStatus.Preparing,
					OrderStatus.OutForDelivery,
				],
			};
		} else if (status === "completed") {
			where.status = {
				in: [OrderStatus.Delivered, OrderStatus.Cancelled],
			};
		}

		const orders = await prisma.order.findMany({
			where,
			include: {
				user: { select: { name: true, email: true, phone: true } },
			},
			orderBy: { createdAt: "desc" },
		});

		return res.status(200).json({
			success: true,
			data: { orders },
		});
	} catch (error) {
		console.error("[getMyDeliveries]", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to fetch deliveries.",
		});
	}
};

// * ─── GET api/delivery/my-deliveries/:id ───────────────────────────────────────
export const getDeliveryDetail = async (req: Request, res: Response) => {
	try {
		const id = getParamId(req);
		if (!id) {
			return sendInvalidId(res, "delivery");
		}

		const order = await prisma.order.findFirst({
			where: { id, deliveryPartnerId: req.partner!.id },
			include: {
				user: { select: { name: true, email: true, phone: true } },
			},
		});

		if (!order) {
			return res.status(404).json({
				success: false,
				code: "DELIVERY_NOT_FOUND",
				message: "Delivery not found.",
			});
		}

		return res.status(200).json({
			success: true,
			data: { order },
		});
	} catch (error) {
		console.error("[getDeliveryDetail]", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to fetch delivery.",
		});
	}
};

// * ─── PUT api/delivery/my-deliveries/:id/complete ─────────────────────────
export const completeDelivery = async (req: Request, res: Response) => {
	try {
		const id = getParamId(req);
		if (!id) {
			return sendInvalidId(res, "delivery");
		}

		const { otp } = req.body as { otp?: unknown };
		if (!otp || typeof otp !== "string") {
			return res.status(400).json({
				success: false,
				code: "MISSING_OTP",
				message: "OTP is required.",
			});
		}

		const order = await prisma.order.findFirst({
			where: { id, deliveryPartnerId: req.partner!.id },
		});

		if (!order) {
			return res.status(404).json({
				success: false,
				code: "DELIVERY_NOT_FOUND",
				message: "Delivery not found.",
			});
		}

		if (isTerminalOrderStatus(order.status)) {
			return res.status(409).json({
				success: false,
				code: "INVALID_STATE",
				message: `Cannot complete a ${order.status.toLowerCase()} order.`,
			});
		}

		// Wrong OTP is a client error — 400
		if (order.deliveryOtp !== otp) {
			return res.status(400).json({
				success: false,
				code: "INVALID_OTP",
				message: "The OTP entered is incorrect.",
			});
		}

		const updated = await prisma.order.update({
			where: { id: order.id },
			data: {
				status: OrderStatus.Delivered,
				statusHistory: appendStatusHistory(
					order.statusHistory,
					OrderStatus.Delivered,
					"Delivered successfully",
				),
				deliveryOtp: "", // clear OTP after use — can't replay it
				isPaid: true,
			},
		});

		return res.status(200).json({
			success: true,
			message: "Delivery completed successfully.",
			data: { order: updated },
		});
	} catch (error) {
		console.error("[completeDelivery]", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to complete delivery.",
		});
	}
};

// * ─── PUT api/delivery/my-deliveries/:id/cancel ───────────────────────────────────────────────────────
export const cancelDelivery = async (req: Request, res: Response) => {
	try {
		const id = getParamId(req);
		if (!id) {
			return sendInvalidId(res, "delivery");
		}

		const order = await prisma.order.findFirst({
			where: { id, deliveryPartnerId: req.partner!.id },
		});

		if (!order) {
			return res.status(404).json({
				success: false,
				code: "DELIVERY_NOT_FOUND",
				message: "Delivery not found.",
			});
		}

		if (order.status === OrderStatus.Delivered) {
			return res.status(409).json({
				success: false,
				code: "INVALID_STATE",
				message:
					"Cannot cancel an order that has already been delivered.",
			});
		}

		if (order.status === OrderStatus.Cancelled) {
			return res.status(409).json({
				success: false,
				code: "ALREADY_CANCELLED",
				message: "This order is already cancelled.",
			});
		}

		const { reason } = req.body as { reason?: unknown };
		const note =
			typeof reason === "string" && reason.trim()
				? reason.trim().slice(0, 250)
				: "Cancelled by delivery partner";

		const updated = await prisma.$transaction(async (tx) => {
			const items = Array.isArray(order.items) ? order.items : [];
			for (const item of items) {
				if (
					item &&
					typeof item === "object" &&
					typeof (item as { product?: unknown }).product ===
						"string" &&
					typeof (item as { quantity?: unknown }).quantity ===
						"number"
				) {
					await tx.product.updateMany({
						where: { id: (item as { product: string }).product },
						data: {
							stock: {
								increment: (item as { quantity: number })
									.quantity,
							},
						},
					});
				}
			}

			return tx.order.update({
				where: { id: order.id },
				data: {
					status: OrderStatus.Cancelled,
					statusHistory: appendStatusHistory(
						order.statusHistory,
						OrderStatus.Cancelled,
						note,
					),
				},
			});
		});

		return res.status(200).json({
			success: true,
			message: "Delivery cancelled.",
			data: { order: updated },
		});
	} catch (error) {
		console.error("[cancelDelivery]", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to cancel delivery.",
		});
	}
};

// * ─── PUT /api/delivery/my-deliveries/:id/status ───────────────────────────────
export const updateDeliveryStatus = async (req: Request, res: Response) => {
	try {
		const id = getParamId(req);
		if (!id) {
			return sendInvalidId(res, "delivery");
		}

		const { status } = req.body as { status?: unknown };

		const allowedStatuses: OrderStatus[] = [
			OrderStatus.Preparing,
			OrderStatus.OutForDelivery,
		];

		if (!status || !allowedStatuses.includes(status as OrderStatus)) {
			return res.status(400).json({
				success: false,
				code: "INVALID_STATUS",
				message: `Status must be one of: ${allowedStatuses.join(", ")}.`,
			});
		}

		const order = await prisma.order.findFirst({
			where: { id, deliveryPartnerId: req.partner!.id },
		});

		if (!order) {
			return res.status(404).json({
				success: false,
				code: "DELIVERY_NOT_FOUND",
				message: "Delivery not found.",
			});
		}

		if (isTerminalOrderStatus(order.status)) {
			return res.status(409).json({
				success: false,
				code: "INVALID_STATE",
				message: `Cannot update a ${order.status.toLowerCase()} order.`,
			});
		}

		if (!canTransitionOrderStatus(order.status, status as OrderStatus)) {
			return res.status(409).json({
				success: false,
				code: "INVALID_ORDER_STATE",
				message: `Cannot change a delivery from ${order.status} to ${status}.`,
			});
		}

		const updated = await prisma.order.update({
			where: { id: order.id },
			data: {
				status: status as OrderStatus,
				statusHistory: appendStatusHistory(
					order.statusHistory,
					status as OrderStatus,
					`Status updated to ${status}`,
				),
			},
		});

		return res.status(200).json({
			success: true,
			message: "Status updated.",
			data: { order: updated },
		});
	} catch (error) {
		console.error("[updateDeliveryStatus]", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to update status.",
		});
	}
};

// * ─── PUT /api/delivery/my-deliveries/:id/location ────────────────────────────
export const updateLocation = async (req: Request, res: Response) => {
	try {
		const id = getParamId(req);
		if (!id) {
			return sendInvalidId(res, "delivery");
		}

		const { lat, lng } = req.body as Record<string, unknown>;
		const latNum = Number(lat);
		const lngNum = Number(lng);

		if (
			!Number.isFinite(latNum) ||
			!Number.isFinite(lngNum) ||
			latNum < -90 ||
			latNum > 90 ||
			lngNum < -180 ||
			lngNum > 180
		) {
			return res.status(400).json({
				success: false,
				code: "INVALID_COORDINATES",
				message: "Valid lat and lng coordinates are required.",
			});
		}

		// Only update location for active deliveries
		const order = await prisma.order.findFirst({
			where: {
				id,
				deliveryPartnerId: req.partner!.id,
				status: {
					in: ACTIVE_DELIVERY_STATUSES,
				},
			},
		});

		if (!order) {
			return res.status(404).json({
				success: false,
				code: "DELIVERY_NOT_FOUND",
				message: "Active delivery not found.",
			});
		}

		await prisma.order.update({
			where: { id: order.id },
			data: {
				liveLocation: {
					lat: latNum,
					lng: lngNum,
					updatedAt: new Date().toISOString(),
				} as unknown as Prisma.InputJsonValue,
			},
		});

		return res.status(200).json({
			success: true,
			message: "Location updated.",
		});
	} catch (error) {
		console.error("[updateLocation]", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to update location.",
		});
	}
};
