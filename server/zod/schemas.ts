import { z } from "zod";

// ─── Zod schemas ─────────────────────────────────────────────────────────────

// CreateProductSchema validates the full body for POST /api/products.
// Every required field is explicit. Optional fields have safe defaults.
export const CreateProductSchema = z.object({
	name: z.string().min(2).max(200).trim(),
	price: z
		.number("price must be a number")
		.positive("Price must be a positive number"),
	image: z.string().url({ message: "image must be a valid URL" }),
	category: z.string().min(1).trim(),
	description: z.string().max(1000).trim().optional().default(""),
	originalPrice: z.number().positive().optional(),
	unit: z.string().min(1).optional().default("piece"),
	stock: z.number().int().min(0).optional().default(0),
	isOrganic: z.boolean().optional().default(false),
});

// UpdateProductSchema is identical shape but every field is optional —
// you can PATCH just the price without sending the whole product.
// .partial() does this automatically — no duplication.
export const UpdateProductSchema = CreateProductSchema.partial();

// QuerySchema validates GET /api/products query params.
// z.coerce.number() safely converts the string "10" → 10,
// replacing the manual Number() + isNaN dance.
export const QuerySchema = z.object({
	category: z.string().optional(),
	search: z.string().max(100).optional(),
	minPrice: z.coerce.number().min(0).optional(),
	maxPrice: z.coerce.number().min(0).optional(),
	sort: z.enum(["price-low", "price-high", "newest"]).optional(),
});
