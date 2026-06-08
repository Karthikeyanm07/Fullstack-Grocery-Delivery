import bcrypt from "bcrypt";
import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { BCRYPT_ROUNDS } from "../utils/authConstants.js";
import { CreatePartnerSchema, UpdatePartnerSchema } from "../utils/schemas.js";
import { getParamId, normalizeEmail } from "../utils/helper.js";
import { OrderStatus, Prisma } from "../generated/prisma/client.js";
import crypto from "crypto";
import { appendStatusHistory, isTerminalOrderStatus } from "../utils/order.js";
import { sendInvalidId } from "../utils/request.js";

// * ─── Helpers ──────────────────────────────────────────────────────────────────
// Strip password from partner before sending — never expose hashes
const safePartner = (p: { password: string; [key: string]: unknown }) => {
	const { password: _pw, ...rest } = p;
	return rest;
};

// * ─── GET admin dashboard stats ────────────────────────────────────────────────
export const getAdminStats = async (_req: Request, res: Response) => {
	try {
		const [
			totalOrders,
			totalUsers,
			totalProducts,
			outOfStock,
			totalPartners,
			recentOrders,
		] = await Promise.all([
			prisma.order.count({
				where: {
					NOT: [{ paymentMethod: "card", isPaid: false }],
				},
			}),

			prisma.user.count(),
			prisma.product.count(),
			prisma.product.count({ where: { stock: 0 } }),
			prisma.deliveryPartner.count(),
			prisma.order.findMany({
				where: {
					NOT: [
						{
							paymentMethod: "card",
							isPaid: false,
						},
					],
				},
				orderBy: {
					createdAt: "desc",
				},
				take: 8,
				include: {
					user: { select: { name: true, email: true } },
					deliveryPartner: { select: { name: true, phone: true } },
				},
			}),
		]);

		return res.status(200).json({
			success: true,
			data: {
				totalOrders,
				totalUsers,
				totalProducts,
				outOfStock,
				totalPartners,
				recentOrders,
			},
		});
	} catch (error) {
		console.error("[getAdminStats]", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to fetch admin stats.",
		});
	}
};

// * ─── GET Delivery partners list for admin ────────────────────────────────────
export const getDeliveryPartners = async (_req: Request, res: Response) => {
	try {
		const partners = await prisma.deliveryPartner.findMany({
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				name: true,
				email: true,
				phone: true,
				avatar: true,
				vehicleType: true,
				isActive: true,
				createdAt: true,
				updatedAt: true,
			},
		});

		return res.status(200).json({
			success: true,
			data: { partners },
		});
	} catch (error) {
		console.error("[getDeliveryPartners]", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to fetch delivery partners.",
		});
	}
};

// * ─── POST Create delivery partner profile ────────────────────────────────────
export const createDeliveryPartner = async (req: Request, res: Response) => {
	try {
		const parsed = CreatePartnerSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({
				success: false,
				code: "VALIDATION_ERROR",
				message: parsed.error.flatten().fieldErrors,
			});
		}

		const { name, email, password, phone, vehicleType } = parsed.data;
		const normalizedEmail = normalizeEmail(email);

		if (!normalizedEmail) {
			return res.status(400).json({
				success: false,
				code: "INVALID_EMAIL",
				message: "Please provide a valid email address",
			});
		}

		const existing = await prisma.deliveryPartner.findUnique({
			where: { email: normalizedEmail },
		});
		if (existing) {
			return res.status(409).json({
				success: false,
				code: "EMAIL_ALREADY_EXISTS",
				message: "A delivery partner with this email already exists.",
			});
		}

		const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

		const partner = await prisma.deliveryPartner.create({
			data: {
				name,
				email: normalizedEmail,
				password: hashedPassword,
				phone,
				vehicleType,
			},
		});

		return res.status(201).json({
			success: true,
			message: "Delivery partner created successfully.",
			data: { partner: safePartner(partner) },
		});
	} catch (error) {
		console.error("[createDeliveryPartner]", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to create delivery partner.",
		});
	}
};

// * ─── PUT /api/admin/partners/:id ──────────────────────────────────────────────
export const updateDeliveryPartner = async (req: Request, res: Response) => {
	try {
		const id = getParamId(req);
		if (!id) {
			return sendInvalidId(res, "partner");
		}

		const parsed = UpdatePartnerSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({
				success: false,
				code: "VALIDATION_ERROR",
				message: parsed.error.flatten().fieldErrors,
			});
		}

		if (Object.keys(parsed.data).length === 0) {
			return res.status(400).json({
				success: false,
				code: "NO_FIELDS",
				message: "At least one field must be provided to update.",
			});
		}

		const existing = await prisma.deliveryPartner.findUnique({
			where: { id },
		});
		if (!existing) {
			return res.status(404).json({
				success: false,
				code: "PARTNER_NOT_FOUND",
				message: "Delivery partner not found.",
			});
		}

		const partner = await prisma.deliveryPartner.update({
			where: { id },
			data: parsed.data satisfies Prisma.DeliveryPartnerUpdateInput,
		});

		return res.status(200).json({
			success: true,
			message: "Delivery partner updated.",
			data: { partner: safePartner(partner) },
		});
	} catch (error) {
		console.error("[updateDeliveryPartner]", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to update delivery partner.",
		});
	}
};

// * ─── POST /api/admin/orders/:id/assign ───────────────────────────────────────
export const assignDeliveryPartner = async (req: Request, res: Response) => {
	try {
		const orderId = getParamId(req);
		if (!orderId) {
			return sendInvalidId(res, "order");
		}

		const { partnerId } = req.body as { partnerId?: unknown };
		if (!partnerId || typeof partnerId !== "string") {
			return res.status(400).json({
				success: false,
				code: "MISSING_PARTNER_ID",
				message: "partnerId is required.",
			});
		}

		// Fetch both in parallel
		const [order, partner] = await Promise.all([
			prisma.order.findUnique({ where: { id: orderId } }),
			prisma.deliveryPartner.findUnique({ where: { id: partnerId } }),
		]);

		if (!order) {
			return res.status(404).json({
				success: false,
				code: "ORDER_NOT_FOUND",
				message: "Order not found.",
			});
		}

		if (!partner) {
			return res.status(404).json({
				success: false,
				code: "PARTNER_NOT_FOUND",
				message: "Delivery partner not found.",
			});
		}

		if (!partner.isActive) {
			return res.status(409).json({
				success: false,
				code: "PARTNER_INACTIVE",
				message: "Cannot assign an inactive delivery partner.",
			});
		}

		// Guard against assigning a partner to an already delivered/cancelled order
		if (isTerminalOrderStatus(order.status)) {
			return res.status(409).json({
				success: false,
				code: "INVALID_ORDER_STATE",
				message: `Cannot assign a partner to a ${order.status.toLowerCase()} order.`,
			});
		}

		if (order.paymentMethod === "card" && !order.isPaid) {
			return res.status(409).json({
				success: false,
				code: "PAYMENT_PENDING",
				message: "Cannot assign a delivery partner before payment is completed.",
			});
		}

		// Generate a 6-digit OTP for delivery confirmation
		const otp = String(crypto.randomInt(100000, 1000000));

		// Use the updated order — original returned pre-update stale `order` object
		const updatedOrder = await prisma.order.update({
			where: { id: orderId },
			data: {
				deliveryPartnerId: partner.id,
				deliveryOtp: otp,
				status: OrderStatus.Confirmed,
				statusHistory: appendStatusHistory(
					order.statusHistory,
					OrderStatus.Confirmed,
					`Assigned to ${partner.name}`,
				),
			},
		});

		return res.status(200).json({
			success: true,
			message: `Order assigned to ${partner.name}.`,
			data: { order: updatedOrder },
		});
	} catch (error) {
		console.error("[assignDeliveryPartner]", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to assign delivery partner.",
		});
	}
};
