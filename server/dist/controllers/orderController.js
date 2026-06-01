import { prisma } from "../config/prisma.js";
import { DELIVERY_FEE, FREE_DELIVERY_THRESHOLD, ORDER_CREATE_MAX_ATTEMPTS, ORDER_CREATE_WINDOW_MS, TAX_RATE, } from "../constants/authConstants.js";
import { checkRateLimit } from "../utils/rateLimiter.js";
import { inngest } from "../inngest/index.js";
import { validStatuses } from "../constants/utilities.js";
// ─── Helper ───────────────────────────────────────────────────────────────────
const getParamId = (req) => {
    const { id } = req.params;
    return typeof id === "string" && id.length > 0 ? id : null;
};
//Create Order
// ─── POST /api/orders ──────────────────────────────────────────────────────
export const createOrder = async (req, res) => {
    try {
        const rateLimit = await checkRateLimit({
            key: `order-create:${req.user.id}`,
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
        const { items, shippingAddress, paymentMethod } = req.body;
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
            if (!item.quantity ||
                typeof item.quantity !== "number" ||
                item.quantity < 1) {
                return res.status(400).json({
                    success: false,
                    code: "INVALID_QUANTITY",
                    message: "Each item must have a quantity of at least 1.",
                });
            }
        }
        // ── Fetch products from DB — never trust client-sent prices ────────────
        // A client could send { price: 1 } for a ₹500 item. Always read price
        // from the DB and ignore whatever the client sent.
        const productIds = items.map((i) => i.product);
        const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
        });
        const productMap = {};
        products.forEach((p) => (productMap[p.id] = p));
        // ── Stock check ─────────────────────────────────────────────────────────
        for (const item of items) {
            const product = productMap[item.product];
            if (!product) {
                return res.status(404).json({
                    success: false,
                    code: "PRODUCT_NOT_FOUND",
                    message: `Product not found.`,
                });
            }
            if ((product.stock ?? 0) < item.quantity) {
                // 409 Conflict — product exists but can't fulfil the requested quantity
                return res.status(409).json({
                    success: false,
                    code: "INSUFFICIENT_STOCK",
                    message: `"${product.name}" only has ${product.stock} units available.`,
                });
            }
        }
        // ── Build order items using DB prices ───────────────────────────────────
        const orderItems = items.map((item) => {
            const dbProduct = productMap[item.product];
            return {
                product: dbProduct.id,
                name: dbProduct.name,
                image: dbProduct.image,
                price: dbProduct.price, // always from DB, never from client
                quantity: item.quantity,
                unit: dbProduct.unit ?? null,
            };
        });
        // ── Calculate totals ────────────────────────────────────────────────────
        const subtotal = Math.round(orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100;
        const deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
        const tax = Math.round(subtotal * TAX_RATE * 100) / 100; // e.g. 8%
        const total = Math.round((subtotal + deliveryFee + tax) * 100) / 100;
        // ── Prisma transaction — order creation + stock decrement ───────────────
        // A transaction means ALL of these DB operations succeed together or
        // ALL are rolled back. Without this, if stock decrement fails after
        // the order is created, you have an order with no stock deducted.
        // Also: we respond to the client AFTER the transaction, not before.
        const order = await prisma.$transaction(async (tx) => {
            const created = await tx.order.create({
                data: {
                    userId: req.user.id,
                    items: orderItems,
                    shippingAddress: shippingAddress,
                    paymentMethod,
                    subtotal,
                    deliveryFee,
                    tax,
                    total,
                    statusHistory: [
                        {
                            status: "Placed",
                            note: "Order placed successfully",
                            timestamp: new Date().toISOString(),
                        },
                    ],
                },
            });
            // Decrement stock for every item inside the same transaction
            for (const item of orderItems) {
                await tx.product.update({
                    where: { id: item.product },
                    data: { stock: { decrement: item.quantity } },
                });
            }
            return created;
        });
        // ── Fire Inngest event for low-stock check ──────────────────────────────
        // This runs in the background after the response is sent.
        // One event per product — each triggers an independent check.
        await Promise.all(orderItems.map((item) => inngest.send({
            name: "inventory/stock.updated",
            data: { productId: item.product },
        })));
        await inngest.send({
            name: "order/placed",
            data: { orderId: order.id },
        });
        return res.status(201).json({
            success: true,
            message: "Order placed successfully.",
            data: { order },
        });
    }
    catch (error) {
        console.error("[createOrder]", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: "Failed to place order.",
        });
    }
};
// Get User's orders
// ─── GET /api/orders ──────────────────────────────────────────────────────
export const getUserOrders = async (req, res) => {
    try {
        const { status } = req.query;
        const where = {
            userId: req.user.id,
            NOT: [{ paymentMethod: "card", isPaid: false }],
        };
        // Validate status against the enum before querying
        if (status && status !== "all") {
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    code: "INVALID_STATUS",
                    message: `Status must be one of: ${validStatuses.join(", ")}.`,
                });
            }
            where.status = status;
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
    }
    catch (error) {
        console.error("[getUserOrders]", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: "Failed to fetch orders.",
        });
    }
};
// get single order
// ─── GET /api/orders/:id ──────────────────────────────────────────────────────
export const getOrder = async (req, res) => {
    try {
        const id = getParamId(req);
        if (!id) {
            return res.status(400).json({
                success: false,
                code: "INVALID_ID",
                message: "Invalid order ID.",
            });
        }
        const order = await prisma.order.findFirst({
            // userId check ensures users can only access their own orders
            where: { id, userId: req.user.id },
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
    }
    catch (error) {
        console.error("[getOrder]", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: "Failed to fetch order.",
        });
    }
};
// Update order status (admin)
// ─── PUT /api/orders/:id/status ──────────────────────────────────────────────────────
export const updateOrderStatus = async (req, res) => {
    try {
        const id = getParamId(req);
        if (!id) {
            return res.status(400).json({
                success: false,
                code: "INVALID_ID",
                message: "Invalid order ID.",
            });
        }
        const { status, note } = req.body;
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
        const history = (Array.isArray(order.statusHistory) ? order.statusHistory : []);
        history.push({
            status,
            note: note?.trim() || `Order ${status.toLowerCase()}`,
            timestamp: new Date().toISOString(),
        });
        const updated = await prisma.order.update({
            where: { id },
            data: {
                status: status,
                statusHistory: history,
            },
        });
        return res.status(200).json({
            success: true,
            message: "Order status updated.",
            data: { order: updated },
        });
    }
    catch (error) {
        console.error("[updateOrderStatus]", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: "Failed to update order status.",
        });
    }
};
// Get all orders (admin)
// ─── GET /api/orders/all ──────────────────────────────────────────────────────
export const getAllOrders = async (req, res) => {
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
    }
    catch (error) {
        console.error("[getAllOrders]", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: "Failed to fetch orders.",
        });
    }
};
// Get Order Location
// ─── GET /api/orders/:id/location ──────────────────────────────────────────────────────
export const getOrderLocation = async (req, res) => {
    try {
        const id = getParamId(req);
        if (!id) {
            return res.status(400).json({
                success: false,
                code: "INVALID_ID",
                message: "Invalid order ID.",
            });
        }
        const order = await prisma.order.findFirst({
            where: { id, userId: req.user.id },
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
    }
    catch (error) {
        console.error("[getOrderLocation]", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: "Failed to fetch order location.",
        });
    }
};
