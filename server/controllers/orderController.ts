import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import {
	DELIVERY_FEE,
	FREE_DELIVERY_THRESHOLD,
	ORDER_CREATE_MAX_ATTEMPTS,
	ORDER_CREATE_WINDOW_MS,
	TAX_RATE,
} from "../utils/authConstants.js";
import { checkRateLimit } from "../utils/rateLimiter.js";
import { OrderStatus, Prisma } from "../generated/prisma/client.js";
import { inngest } from "../inngest/index.js";
import { getParamId, validStatuses } from "../utils/helper.js";
import {
	appendStatusHistory,
	canTransitionOrderStatus,
} from "../utils/order.js";
import { sendInvalidId } from "../utils/request.js";

// * ─── Types ─────────────────────────────────────────────────────────────

interface OrderItemInput {
	product: string; // product ID
	quantity: number;
}

interface OrderItemRecord {
	product: string;
	name: string;
	image: string;
	price: number;
	quantity: number;
	unit: string | null;
}

const getStockItemsFromOrder = (items: unknown): OrderItemInput[] => {
	if (!Array.isArray(items)) {
		return [];
	}

	return items
		.map((item) => {
			if (
				!item ||
				typeof item !== "object" ||
				typeof (item as OrderItemRecord).product !== "string" ||
				typeof (item as OrderItemRecord).quantity !== "number"
			) {
				return null;
			}

			return {
				product: (item as OrderItemRecord).product,
				quantity: (item as OrderItemRecord).quantity,
			};
		})
		.filter((item): item is OrderItemInput => Boolean(item));
};

const aggregateItems = (items: OrderItemInput[]): OrderItemInput[] => {
	const quantitiesByProduct = new Map<string, number>();

	for (const item of items) {
		quantitiesByProduct.set(
			item.product,
			(quantitiesByProduct.get(item.product) ?? 0) + item.quantity,
		);
	}

	return Array.from(quantitiesByProduct, ([product, quantity]) => ({
		product,
		quantity,
	}));
};

// * ─── POST /api/orders ───────────────────────────────────────────────────
export const createOrder = async (req: Request, res: Response) => {
	try {
		const rateLimit = await checkRateLimit({
			key: `order-create:${req.user!.id}`,
			maxAttempts: ORDER_CREATE_MAX_ATTEMPTS,
			windowMS: ORDER_CREATE_WINDOW_MS,
		});
		if (!rateLimit.allowed) {
			return res.status(429).json({
				success: false,
				code: "TOO_MANY_REQUESTS",
				message: `Too many orders placed. Try again in ${Math.ceil(rateLimit.retryAfterMS / 1000)} seconds.`,
			});
		}

		const { items, shippingAddress, paymentMethod } = req.body as {
			items: OrderItemInput[];
			shippingAddress: unknown;
			paymentMethod: string;
		};

		if (!Array.isArray(items) || items.length === 0) {
			return res.status(400).json({
				success: false,
				code: "MISSING_ITEMS",
				message: "Order must contain at least one item.",
			});
		}
		if (!shippingAddress) {
			return res.status(400).json({
				success: false,
				code: "MISSING_SHIPPING_ADDRESS",
				message: "Shipping address is required.",
			});
		}
		const validPaymentMethods = ["card", "cash"];
		if (!paymentMethod || !validPaymentMethods.includes(paymentMethod)) {
			return res.status(400).json({
				success: false,
				code: "INVALID_PAYMENT_METHOD",
				message: `Payment method must be one of: ${validPaymentMethods.join(", ")}.`,
			});
		}

		// Validate each item has a product ID and a positive quantity
		for (const item of items) {
			if (!item.product || typeof item.product !== "string") {
				return res.status(400).json({
					success: false,
					code: "INVALID_ITEM",
					message: "Each item must have a valid product ID.",
				});
			}
			if (
				!item.quantity ||
				typeof item.quantity !== "number" ||
				!Number.isInteger(item.quantity) ||
				item.quantity < 1
			) {
				return res.status(400).json({
					success: false,
					code: "INVALID_QUANTITY",
					message:
						"Each item must have a whole-number quantity of at least 1.",
				});
			}
		}

		const cartItems = aggregateItems(items);
		const productIds = cartItems.map((i) => i.product);
		const products = await prisma.product.findMany({
			where: { id: { in: productIds } },
		});

		const productMap: Record<string, (typeof products)[0]> = {};
		products.forEach((p) => (productMap[p.id] = p));

		// ── Stock check
		for (const item of cartItems) {
			const product = productMap[item.product];

			if (!product) {
				return res.status(404).json({
					success: false,
					code: "PRODUCT_NOT_FOUND",
					message: `Product not found.`,
				});
			}

			if ((product.stock ?? 0) < item.quantity) {
				return res.status(409).json({
					success: false,
					code: "INSUFFICIENT_STOCK",
					message: `"${product.name}" only has ${product.stock} units available.`,
				});
			}
		}

		const orderItems: OrderItemRecord[] = cartItems.map((item) => {
			const dbProduct = productMap[item.product];
			return {
				product: dbProduct.id,
				name: dbProduct.name,
				image: dbProduct.image,
				price: dbProduct.price,
				quantity: item.quantity,
				unit: dbProduct.unit ?? null,
			};
		});

		// ── Calculate totals
		const subtotal =
			Math.round(
				orderItems.reduce(
					(sum, item) => sum + item.price * item.quantity,
					0,
				) * 100,
			) / 100;
		const deliveryFee =
			subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
		const tax = Math.round(subtotal * TAX_RATE * 100) / 100; // e.g. 8%
		const total = Math.round((subtotal + deliveryFee + tax) * 100) / 100;

		const order = await prisma.$transaction(async (tx) => {
			for (const item of orderItems) {
				const updated = await tx.product.updateMany({
					where: {
						id: item.product,
						stock: { gte: item.quantity },
					},
					data: { stock: { decrement: item.quantity } },
				});

				if (updated.count !== 1) {
					throw new Error("INSUFFICIENT_STOCK");
				}
			}

			const created = await tx.order.create({
				data: {
					userId: req.user!.id,
					items: orderItems as unknown as Prisma.JsonArray,
					shippingAddress: shippingAddress as Prisma.InputJsonValue,
					paymentMethod,
					subtotal,
					deliveryFee,
					tax,
					total,
					statusHistory: [
						{
							status: OrderStatus.Placed,
							note: "Order placed successfully",
							timestamp: new Date().toISOString(),
						},
					] as unknown as Prisma.InputJsonValue,
				},
			});

			return created;
		});

		await Promise.all(
			orderItems.map((item) =>
				inngest.send({
					name: "inventory/stock.updated",
					data: { productId: item.product },
				}),
			),
		);

		await inngest.send({
			name: "order/placed",
			data: { orderId: order.id },
		});

		return res.status(201).json({
			success: true,
			message: "Order placed successfully.",
			data: { order },
		});
	} catch (error) {
		console.error("[createOrder]", error);
		if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
			return res.status(409).json({
				success: false,
				code: "INSUFFICIENT_STOCK",
				message:
					"Some items no longer have enough stock. Please review your cart.",
			});
		}
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to place order.",
		});
	}
};

// * ─── GET /api/orders ───────────────────────────────────────────────────
export const getUserOrders = async (req: Request, res: Response) => {
	try {
		const { status } = req.query;

		const where: Prisma.OrderWhereInput = {
			userId: req.user!.id,
			NOT: [{ paymentMethod: "card", isPaid: false }],
		};

		if (status && status !== "all") {
			if (!validStatuses.includes(status as string)) {
				return res.status(400).json({
					success: false,
					code: "INVALID_STATUS",
					message: `Status must be one of: ${validStatuses.join(", ")}.`,
				});
			}
			where.status = status as OrderStatus;
		}

		const orders = await prisma.order.findMany({
			where,
			include: {
				deliveryPartner: { select: { name: true, phone: true } },
			},
			orderBy: { createdAt: "desc" },
		});

		return res.status(200).json({
			success: true,
			data: { orders },
		});
	} catch (error) {
		console.error("[getUserOrders]", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to fetch orders.",
		});
	}
};

// * ─── GET /api/orders/:id ───────────────────────────────────────────────────
export const getOrder = async (req: Request, res: Response) => {
	try {
		const id = getParamId(req);
		if (!id) {
			return sendInvalidId(res, "order");
		}

		const order = await prisma.order.findFirst({
			// userId check ensures users can only access their own orders
			where: { id, userId: req.user!.id },
			include: {
				deliveryPartner: {
					select: {
						name: true,
						phone: true,
						avatar: true,
						vehicleType: true,
					},
				},
			},
		});

		if (!order) {
			return res.status(404).json({
				success: false,
				code: "ORDER_NOT_FOUND",
				message: "Order not found.",
			});
		}

		return res.status(200).json({
			success: true,
			data: { order },
		});
	} catch (error) {
		console.error("[getOrder]", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to fetch order.",
		});
	}
};

// * ─── PUT /api/orders/:id/status ───────────────────────────────────────────────────
export const updateOrderStatus = async (req: Request, res: Response) => {
	try {
		const id = getParamId(req);
		if (!id) {
			return sendInvalidId(res, "order");
		}

		const { status, note } = req.body as { status: string; note?: string };

		if (!status || !validStatuses.includes(status)) {
			return res.status(400).json({
				success: false,
				code: "INVALID_STATUS",
				message: `Status must be one of: ${validStatuses.join(", ")}.`,
			});
		}

		const order = await prisma.order.findUnique({ where: { id } });
		if (!order) {
			return res.status(404).json({
				success: false,
				code: "ORDER_NOT_FOUND",
				message: "Order not found.",
			});
		}

		if (!canTransitionOrderStatus(order.status, status as OrderStatus)) {
			return res.status(409).json({
				success: false,
				code: "INVALID_ORDER_STATE",
				message: `Cannot change an order from ${order.status} to ${status}.`,
			});
		}

		const updated = await prisma.$transaction(async (tx) => {
			if (
				status === OrderStatus.Cancelled &&
				order.status !== OrderStatus.Cancelled
			) {
				for (const item of getStockItemsFromOrder(order.items)) {
					await tx.product.updateMany({
						where: { id: item.product },
						data: { stock: { increment: item.quantity } },
					});
				}
			}

			return tx.order.update({
				where: { id },
				data: {
					status: status as OrderStatus,
					statusHistory: appendStatusHistory(
						order.statusHistory,
						status as OrderStatus,
						note?.trim() || `Order ${status.toLowerCase()}`,
					),
					...(status === OrderStatus.Delivered && { isPaid: true }),
				},
			});
		});

		return res.status(200).json({
			success: true,
			message: "Order status updated.",
			data: { order: updated },
		});
	} catch (error) {
		console.error("[updateOrderStatus]", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to update order status.",
		});
	}
};

// * ─── GET /api/orders/all ───────────────────────────────────────────────────
export const getAllOrders = async (req: Request, res: Response) => {
	try {
		const orders = await prisma.order.findMany({
			where: { NOT: [{ paymentMethod: "card", isPaid: false }] },
			include: {
				user: { select: { name: true, email: true } },
				deliveryPartner: {
					select: { name: true, phone: true, email: true },
				},
			},
			orderBy: { createdAt: "desc" },
		});

		return res.status(200).json({
			success: true,
			data: { orders },
		});
	} catch (error) {
		console.error("[getAllOrders]", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to fetch orders.",
		});
	}
};

// * ─── GET /api/orders/:id/location ───────────────────────────────────────────────────
export const getOrderLocation = async (req: Request, res: Response) => {
	try {
		const id = getParamId(req);
		if (!id) {
			return sendInvalidId(res, "order");
		}

		const order = await prisma.order.findFirst({
			where: { id, userId: req.user!.id },
			select: { liveLocation: true, status: true },
		});

		if (!order) {
			return res.status(404).json({
				success: false,
				code: "ORDER_NOT_FOUND",
				message: "Order not found.",
			});
		}

		return res.status(200).json({
			success: true,
			data: { liveLocation: order.liveLocation, status: order.status },
		});
	} catch (error) {
		console.error("[getOrderLocation]", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to fetch order location.",
		});
	}
};
