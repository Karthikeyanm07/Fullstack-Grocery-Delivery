import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import {
	AUTH_TOKEN_EXPIRY,
	PARTNER_LOGIN_MAX_ATTEMPTS,
	PARTNER_LOGIN_WINDOW_MS,
} from "../constants/authConstants.js";
import { checkRateLimit } from "../utils/rateLimiter.js";
import { getParamId, normalizeEmail } from "../constants/utilities.js";
import { OrderStatus, Prisma } from "../generated/prisma/client.js";

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

const sendPartnerCookie = (res: Response, token: string): void => {
	res.cookie("partnerToken", token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "strict",
		path: "/",
		maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
	});
};

const clearPartnerCookie = (res: Response): void => {
	res.cookie("partnerToken", "", {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "strict",
		path: "/",
		expires: new Date(0),
	});
};

// Build a safe partner object — strips password before any response
const safePartner = (partner: { password: string; [key: string]: unknown }) => {
	const { password: _pw, ...rest } = partner;
	return rest;
};

// * ─── POST api/delivery/login ───────────────────────────────────────────────────────
export const loginPartner = async (req: Request, res: Response) => {
	try {
		const ip =
			(req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ??
			req.socket.remoteAddress ??
			"unknown";

		const rateLimit = await checkRateLimit({
			key: `partner-login:${ip}`,
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

		const DUMMY_HASH =
			"$2b$12$invalidhashpaddingtomatchbcryptlengthandpreventearlyexit";
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

		// Check active status AFTER credential check — don't reveal account exists
		// before verifying the password
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

// ─── POST /api/delivery/logout ────────────────────────────────────────────────
export const logoutPartner = (_req: Request, res: Response) => {
	clearPartnerCookie(res);
	return res.status(200).json({
		success: true,
		message: "Logged out successfully.",
	});
};

// Get assigned deliveries
// * ─── GET api/delivery/my-deliveries ───────────────────────────────────────────────────────
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

// Get single delivery detail
// * ─── GET api/delivery/my-deliveries/:id ───────────────────────────────────────────────────────
export const getDeliveryDetail = async (req: Request, res: Response) => {
	try {
		const id = getParamId(req);
		if (!id) {
			return res.status(400).json({
				success: false,
				code: "INVALID_ID",
				message: "Invalid delivery ID.",
			});
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

// Complete delivery with OTP
// * ─── GET api/delivery/my-deliveries/:id/complete ─────────────────────────
export const completeDelivery = async (req: Request, res: Response) => {
	try {
		const id = getParamId(req);
		if (!id) {
			return res.status(400).json({
				success: false,
				code: "INVALID_ID",
				message: "Invalid delivery ID.",
			});
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

		if (
			order.status === OrderStatus.Cancelled ||
			order.status === OrderStatus.Delivered
		) {
			return res.status(409).json({
				success: false,
				code: "INVALID_STATE",
				message: `Cannot complete a ${order.status.toLowerCase()} order.`,
			});
		}

		// Wrong OTP is a client error — 400, not 500
		if (order.deliveryOtp !== otp) {
			return res.status(400).json({
				success: false,
				code: "INVALID_OTP",
				message: "The OTP entered is incorrect.",
			});
		}

		const history = (
			Array.isArray(order.statusHistory) ? order.statusHistory : []
		) as object[];
		history.push({
			status: OrderStatus.Delivered,
			note: "Delivered successfully",
			timestamp: new Date().toISOString(),
		});

		const updated = await prisma.order.update({
			where: { id: order.id },
			data: {
				status: OrderStatus.Delivered,
				statusHistory: history as unknown as Prisma.InputJsonValue,
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

// Cancel delivery
// * ─── GET api/delivery/my-deliveries/:id/cancel ───────────────────────────────────────────────────────
export const cancelDelivery = async (req: Request, res: Response) => {
	try {
		const id = getParamId(req);
		if (!id) {
			return res.status(400).json({
				success: false,
				code: "INVALID_ID",
				message: "Invalid delivery ID.",
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

		const { reason } = req.body as { reason?: string };
		const history = (
			Array.isArray(order.statusHistory) ? order.statusHistory : []
		) as object[];
		history.push({
			status: OrderStatus.Cancelled,
			note: reason?.trim() || "Cancelled by delivery partner",
			timestamp: new Date().toISOString(),
		});

		const updated = await prisma.order.update({
			where: { id: order.id },
			data: {
				status: OrderStatus.Cancelled,
				statusHistory: history as unknown as Prisma.InputJsonValue,
			},
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

// Update order status
// ─── PUT /api/delivery/my-deliveries/:id/status ───────────────────────────────
export const updateDeliveryStatus = async (req: Request, res: Response) => {
	try {
		const id = getParamId(req);
		if (!id) {
			return res.status(400).json({
				success: false,
				code: "INVALID_ID",
				message: "Invalid delivery ID.",
			});
		}

		const { status } = req.body as { status?: unknown };

		// Only Preparing and OutForDelivery are partner-settable statuses.
		// Delivered is set via completeDelivery (requires OTP).
		// Placed/Confirmed/Cancelled are set by admin or the cancel endpoint.
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

		if (
			order.status === OrderStatus.Delivered ||
			order.status === OrderStatus.Cancelled
		) {
			return res.status(409).json({
				success: false,
				code: "INVALID_STATE",
				message: `Cannot update a ${order.status.toLowerCase()} order.`,
			});
		}

		const history = (
			Array.isArray(order.statusHistory) ? order.statusHistory : []
		) as object[];
		history.push({
			status,
			note: `Status updated to ${status}`,
			timestamp: new Date().toISOString(),
		});

		const updated = await prisma.order.update({
			where: { id: order.id },
			data: {
				status: status as OrderStatus,
				statusHistory: history as unknown as Prisma.InputJsonValue,
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
			return res.status(400).json({
				success: false,
				code: "INVALID_ID",
				message: "Invalid delivery ID.",
			});
		}

		const { lat, lng } = req.body as Record<string, unknown>;
		const latNum = Number(lat);
		const lngNum = Number(lng);

		if (isNaN(latNum) || isNaN(lngNum)) {
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
					in: [
						OrderStatus.Confirmed,
						OrderStatus.Preparing,
						OrderStatus.OutForDelivery,
					],
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
