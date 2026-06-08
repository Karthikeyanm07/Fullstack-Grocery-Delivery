import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { checkRateLimit } from "../utils/rateLimiter.js";
import {
	PRODUCT_WRITE_MAX_ATTEMPTS,
	PRODUCT_WRITE_WINDOW_MS,
} from "../utils/authConstants.js";
import {
	CreateProductSchema,
	QuerySchema,
	UpdateProductSchema,
} from "../utils/schemas.js";
import { Prisma } from "../generated/prisma/client.js";
import { getParamId } from "../utils/helper.js";
import { sendInvalidId } from "../utils/request.js";
// * ─── helpers ───────────────────────────────────────────────────────────
// Discount is a derived value — computed here rather than stored in the DB
const attachDiscount = <
	T extends { price: number; originalPrice?: number | null },
>(
	product: T,
): T & { discount: number } => {
	const discount =
		product.originalPrice && product.originalPrice > product.price
			? Math.round(
					((product.originalPrice - product.price) /
						product.originalPrice) *
						100,
				)
			: 0;
	return { ...product, discount };
};

const checkProductWriteLimit = async (userId: string) => {
	return checkRateLimit({
		key: `product-write:${userId}`,
		maxAttempts: PRODUCT_WRITE_MAX_ATTEMPTS,
		windowMS: PRODUCT_WRITE_WINDOW_MS,
	});
};

// * ─── GET /api/products/flash-deals ───────────────────────────────────────────
export const getFlashDeals = async (_req: Request, res: Response) => {
	try {
		const products = await prisma.product.findMany({
			where: { stock: { gt: 0 } },
			orderBy: { originalPrice: "desc" },
		});

		const withDiscount = products
			.map(attachDiscount)
			.filter((p) => p.discount > 0)
			.slice(0, 8);

		return res
			.status(200)
			.json({ success: true, data: { products: withDiscount } });
	} catch (error) {
		console.error("[getFlashDeals]", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to fetch flash deals.",
		});
	}
};

// * ─── GET /api/products ───────────────────────────────────────────────────────
export const getProducts = async (req: Request, res: Response) => {
	try {
		const parsed = QuerySchema.safeParse(req.query);
		if (!parsed.success) {
			return res.status(400).json({
				success: false,
				code: "INVALID_QUERY",
				message: parsed.error.flatten().fieldErrors,
			});
		}

		const { category, search, minPrice, maxPrice, sort } = parsed.data;

		const where: Prisma.ProductWhereInput = {};

		if (category && category !== "all") {
			where.category = category;
		}
		if (search?.trim()) {
			where.name = { contains: search.trim(), mode: "insensitive" };
		}
		if (minPrice !== undefined || maxPrice !== undefined) {
			where.price = {};
			if (minPrice !== undefined) {
				where.price.gte = minPrice;
			}
			if (maxPrice !== undefined) {
				where.price.lte = maxPrice;
			}
		}

		const orderBy: Prisma.ProductOrderByWithRelationInput =
			sort === "price-low"
				? { price: "asc" }
				: sort === "price-high"
					? { price: "desc" }
					: { createdAt: "desc" };

		const products = await prisma.product.findMany({ where, orderBy });

		return res.status(200).json({
			success: true,
			data: { products: products.map(attachDiscount) },
		});
	} catch (error) {
		console.error("[getProducts]", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to fetch products.",
		});
	}
};

// * ─── GET /api/products/:id ───────────────────────────────────────────────────
export const getProduct = async (req: Request, res: Response) => {
	try {
		const product = await prisma.product.findUnique({
			where: { id: req.params.id as string },
		});
		if (!product) {
			res.status(404).json({
				success: false,
				code: "PRODUCT_NOT_FOUND",
				message: "Product not found",
			});
			return;
		}

		return res.status(200).json({
			success: true,
			data: { product: attachDiscount(product) },
		});
	} catch (error) {
		console.error("[getProduct]", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to fetch product.",
		});
	}
};

// * ─── POST /api/products ──────────────────────────────────────────────────────
export const createProduct = async (req: Request, res: Response) => {
	try {
		const rateLimit = await checkProductWriteLimit(req.user!.id);
		if (!rateLimit.allowed) {
			const retryAfterSec = Math.ceil(rateLimit.retryAfterMS / 1000);

			return res.status(429).json({
				success: false,
				code: "TOO_MANY_REQUESTS",
				message: `Too many requests. Try again in ${retryAfterSec} seconds.`,
			});
		}

		const parsed = CreateProductSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({
				success: false,
				code: "VALIDATION_ERROR",
				message: parsed.error.flatten().fieldErrors,
			});
		}

		const product = await prisma.product.create({ data: parsed.data });

		return res.status(201).json({
			success: true,
			message: "Product created successfully.",
			data: { product: attachDiscount(product) },
		});
	} catch (error) {
		console.error("[createProduct]", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to create product.",
		});
	}
};
// * ─── PUT /api/products/:id ───────────────────────────────────────────────────
export const updateProduct = async (req: Request, res: Response) => {
	try {
		const rateLimit = await checkProductWriteLimit(req.user!.id);
		if (!rateLimit.allowed) {
			const retryAfterSec = Math.ceil(rateLimit.retryAfterMS / 1000);
			return res.status(429).json({
				success: false,
				code: "TOO_MANY_REQUESTS",
				message: `Too many requests. Try again in ${retryAfterSec} seconds.`,
			});
		}

		// Extract and validate id before using it
		const id = getParamId(req);
		if (!id) {
			return sendInvalidId(res, "product");
		}

		const existing = await prisma.product.findUnique({
			where: { id },
		});
		if (!existing) {
			return res.status(404).json({
				success: false,
				code: "PRODUCT_NOT_FOUND",
				message: "Product not found.",
			});
		}

		const parsed = UpdateProductSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({
				success: false,
				code: "VALIDATION_ERROR",
				message: parsed.error.flatten().fieldErrors,
			});
		}

		const product = await prisma.product.update({
			where: { id },
			data: parsed.data,
		});

		return res.status(200).json({
			success: true,
			message: "Product updated successfully.",
			data: { product: attachDiscount(product) },
		});
	} catch (error) {
		console.error("[updateProduct]", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to update product.",
		});
	}
};

// * ─── DELETE /api/products/:id ───────────────────────────────────────────────────
export const deleteProduct = async (req: Request, res: Response) => {
	try {
		const rateLimit = await checkProductWriteLimit(req.user!.id);
		if (!rateLimit.allowed) {
			const retryAfterSec = Math.ceil(rateLimit.retryAfterMS / 1000);
			return res.status(429).json({
				success: false,
				code: "TOO_MANY_REQUESTS",
				message: `Too many requests. Try again in ${retryAfterSec} seconds.`,
			});
		}

		const id = getParamId(req);
		if (!id) {
			return sendInvalidId(res, "product");
		}

		const existing = await prisma.product.findUnique({
			where: { id },
		});
		if (!existing) {
			return res.status(404).json({
				success: false,
				code: "PRODUCT_NOT_FOUND",
				message: "Product not found.",
			});
		}

		await prisma.product.delete({ where: { id } });

		return res.status(200).json({
			success: true,
			message: "Product deleted successfully.",
		});
	} catch (error) {
		console.error("[deleteProduct]", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to delete product.",
		});
	}
};
