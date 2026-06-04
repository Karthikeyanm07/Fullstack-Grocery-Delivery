import { Request } from "express";

export const validStatuses = [
	"Placed",
	"Confirmed",
	"Preparing",
	"OutForDelivery",
	"Delivered",
	"Cancelled",
];

export const getParamId = (req: Request): string | null => {
	const { id } = req.params;
	return typeof id === "string" && id.length > 0 ? id : null;
};

// Normalizing Email
export const normalizeEmail = (raw: unknown): string | null => {
	if (typeof raw !== "string") {
		return null;
	}

	const trimmed = raw.trim().toLowerCase();
	return trimmed.length > 0 ? trimmed : null;
};
