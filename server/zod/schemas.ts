import { z } from "zod";
import { VehicleType } from "../generated/prisma/enums.js";

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

export const AddressSchema = z.object({
	label: z.string().min(1).max(50).trim(),
	address: z.string().min(5).max(200).trim(),
	city: z.string().min(1).max(100).trim(),
	state: z.string().min(1).max(100).trim(),
	zip: z.string().min(1).max(20).trim(),
	isDefault: z.boolean().optional().default(false),
	// coerce converts the string "12.34" → number 12.34 automatically.
	// Without it, lat/lng from form-data would stay as strings and
	// Number(undefined) would silently write NaN into your DB.
	lat: z.coerce.number("lat must be a number"),
	lng: z.coerce.number("lng must be a number"),
});

// Every field optional for updates — only send what changed
export const UpdateAddressSchema = AddressSchema.partial();

export const CreatePartnerSchema = z.object({
	name: z.string().min(2).max(100).trim(),
	email: z.string().email().trim(),
	password: z.string().min(8).max(128),
	phone: z.string().min(7).max(20).trim(),
	vehicleType: z.nativeEnum(VehicleType).optional().default(VehicleType.bike),
});

export const UpdatePartnerSchema = z.object({
	name: z.string().min(2).max(100).trim().optional(),
	phone: z.string().min(7).max(20).trim().optional(),
	vehicleType: z.nativeEnum(VehicleType).optional(),
	// boolean() not boolean().optional() — we need to accept explicit `false`
	// The original `if (isActive)` check skipped `false`, making it impossible
	// to deactivate a partner since false is falsy
	isActive: z.boolean().optional(),
});
