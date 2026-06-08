import { z } from "zod";
import { VehicleType } from "../generated/prisma/enums.js";

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

export const UpdateProductSchema = CreateProductSchema.partial();

export const QuerySchema = z
	.object({
		category: z.string().optional(),
		search: z.string().max(100).optional(),
		minPrice: z.coerce.number().min(0).optional(),
		maxPrice: z.coerce.number().min(0).optional(),
		sort: z.enum(["price-low", "price-high", "newest"]).optional(),
	})
	.refine(
		(data) =>
			data.minPrice === undefined ||
			data.maxPrice === undefined ||
			data.minPrice <= data.maxPrice,
		{
			message: "minPrice cannot be greater than maxPrice",
			path: ["minPrice"],
		},
	);

export const AddressSchema = z.object({
	label: z.string().min(1).max(50).trim(),
	name: z.string().min(1).max(100).trim().optional().default(""),
	phone: z.string().max(20).trim().optional().default(""),
	address: z.string().min(5).max(200).trim(),
	landmark: z.string().max(100).trim().optional().default(""),
	city: z.string().min(1).max(100).trim(),
	state: z.string().min(1).max(100).trim(),
	zip: z.string().min(1).max(20).trim(),
	isDefault: z.boolean().optional().default(false),
	lat: z.coerce.number("lat must be a number").min(-90).max(90),
	lng: z.coerce.number("lng must be a number").min(-180).max(180),
});

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
	isActive: z.boolean().optional(),
});
