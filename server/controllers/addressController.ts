import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { checkRateLimit } from "../utils/rateLimiter.js";
import {
	ADDRESS_WRITE_MAX_ATTEMPTS,
	ADDRESS_WRITE_WINDOW_MS,
	MAX_ADDRESSES_PER_USER,
} from "../utils/authConstants.js";
import { AddressSchema, UpdateAddressSchema } from "../utils/schemas.js";
import { getParamId } from "../utils/helper.js";
import { Prisma } from "../generated/prisma/client.js";

// * ─── Helpers ──────────────────────────────────────────────────────────────────
const checkAddressWriteLimit = (userId: string) =>
	checkRateLimit({
		key: `address-write:${userId}`,
		maxAttempts: ADDRESS_WRITE_MAX_ATTEMPTS,
		windowMS: ADDRESS_WRITE_WINDOW_MS,
	});

const fetchUserAddresses = (userId: string) =>
	prisma.address.findMany({
		where: { userId },
		orderBy: { createdAt: "asc" },
	});

// * ─── GET /api/addresses ───────────────────────────────────────────────────────
export const getAddresses = async (req: Request, res: Response) => {
	try {
		const addresses = await fetchUserAddresses(req.user!.id);

		return res.status(200).json({
			success: true,
			data: { addresses },
		});
	} catch (error) {
		console.error("[getAddresses]", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to fetch addresses.",
		});
	}
};

// * ─── POST /api/addresses ──────────────────────────────────────────────────────
export const addAddress = async (req: Request, res: Response) => {
	try {
		const rateLimit = await checkAddressWriteLimit(req.user!.id);

		if (!rateLimit.allowed) {
			return res.status(429).json({
				success: false,
				code: "TOO_MANY_REQUESTS",
				message: `Too many requests. Try again in ${Math.ceil(rateLimit.retryAfterMS / 1000)} seconds.`,
			});
		}

		// ── Validate input
		const parsed = AddressSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({
				success: false,
				code: "VALIDATION_ERROR",
				message: parsed.error.flatten().fieldErrors,
			});
		}

		const { label, address, city, state, zip, isDefault, lat, lng } =
			parsed.data;

		const existingCount = await prisma.address.count({
			where: { userId: req.user!.id },
		});

		if (existingCount >= MAX_ADDRESSES_PER_USER) {
			return res.status(409).json({
				success: false,
				code: "ADDRESS_LIMIT_REACHED",
				message: `You can save a maximum of ${MAX_ADDRESSES_PER_USER} addresses.`,
			});
		}

		const makeDefault = existingCount === 0 ? true : isDefault;

		const newAddress = await prisma.$transaction(async (tx) => {
			if (makeDefault) {
				await tx.address.updateMany({
					where: { userId: req.user!.id },
					data: { isDefault: false },
				});
			}

			return tx.address.create({
				data: {
					userId: req.user!.id,
					label,
					address,
					city,
					state,
					zip,
					isDefault: makeDefault,
					lat,
					lng,
				},
			});
		});

		const addresses = await fetchUserAddresses(req.user!.id);

		return res.status(201).json({
			success: true,
			message: "Address added successfully.",
			data: { address: newAddress, addresses },
		});
	} catch (error) {
		console.error("[addAddress]", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to add address.",
		});
	}
};

// * ─── PUT /api/addresses/:id ───────────────────────────────────────────────────
export const updateAddress = async (req: Request, res: Response) => {
	try {
		const rateLimit = await checkAddressWriteLimit(req.user!.id);
		if (!rateLimit.allowed) {
			return res.status(429).json({
				success: false,
				code: "TOO_MANY_REQUESTS",
				message: `Too many requests. Try again in ${Math.ceil(rateLimit.retryAfterMS / 1000)} seconds.`,
			});
		}

		const id = getParamId(req);
		if (!id) {
			return res.status(400).json({
				success: false,
				code: "INVALIDid",
				message: "Invalid address ID.",
			});
		}

		// ── Validate input ──────────────────────────────────────────────────────
		const parsed = UpdateAddressSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({
				success: false,
				code: "VALIDATION_ERROR",
				message: parsed.error.flatten().fieldErrors,
			});
		}

		const existing = await prisma.address.findUnique({ where: { id } });

		if (!existing) {
			return res.status(404).json({
				success: false,
				code: "ADDRESS_NOT_FOUND",
				message: "Address not found.",
			});
		}

		if (existing.userId !== req.user!.id) {
			return res.status(404).json({
				success: false,
				code: "ADDRESS_NOT_FOUND",
				message: "Address not found.",
			});
		}

		const { isDefault, ...rest } = parsed.data;

		const updated = await prisma.$transaction(async (tx) => {
			if (isDefault === true) {
				await tx.address.updateMany({
					where: { userId: req.user!.id },
					data: { isDefault: false },
				});
			}

			return tx.address.update({
				where: { id },
				data: {
					...rest,
					...(isDefault !== undefined && { isDefault }),
				} satisfies Prisma.AddressUpdateInput,
			});
		});

		const addresses = await fetchUserAddresses(req.user!.id);

		return res.status(200).json({
			success: true,
			message: "Address updated successfully.",
			data: { address: updated, addresses },
		});
	} catch (error) {
		console.error("[updateAddress]", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to update address.",
		});
	}
};

// * ─── DELETE /api/addresses/:id ───────────────────────────────────────────────────────
export const deleteAddress = async (req: Request, res: Response) => {
	try {
		// ── Rate limit ──────────────────────────────────────────────────────────
		const rateLimit = await checkAddressWriteLimit(req.user!.id);
		if (!rateLimit.allowed) {
			return res.status(429).json({
				success: false,
				code: "TOO_MANY_REQUESTS",
				message: `Too many requests. Try again in ${Math.ceil(rateLimit.retryAfterMS / 1000)} seconds.`,
			});
		}

		const id = getParamId(req);
		if (!id) {
			return res.status(400).json({
				success: false,
				code: "INVALIDid",
				message: "Invalid address ID.",
			});
		}

		const existing = await prisma.address.findUnique({ where: { id } });
		if (!existing) {
			return res.status(404).json({
				success: false,
				code: "ADDRESS_NOT_FOUND",
				message: "Address not found.",
			});
		}

		if (existing.userId !== req.user!.id) {
			return res.status(404).json({
				success: false,
				code: "ADDRESS_NOT_FOUND",
				message: "Address not found.",
			});
		}

		await prisma.address.delete({ where: { id } });

		if (existing.isDefault) {
			const next = await prisma.address.findFirst({
				where: { userId: req.user!.id },
				orderBy: { createdAt: "asc" },
			});

			if (next) {
				await prisma.address.update({
					where: { id: next.id },
					data: { isDefault: true },
				});
			}
		}

		const addresses = await fetchUserAddresses(req.user!.id);

		return res.status(200).json({
			success: true,
			message: "Address deleted successfully.",
			data: { addresses },
		});
	} catch (error) {
		console.error("[deleteAddress]", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to delete address.",
		});
	}
};
