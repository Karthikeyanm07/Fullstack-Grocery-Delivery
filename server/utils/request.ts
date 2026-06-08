import { Request, Response } from "express";
import { checkRateLimit } from "./rateLimiter.js";

export const getClientIP = (req: Request): string => {
	const forwarded = req.headers["x-forwarded-for"];

	if (typeof forwarded === "string") {
		return forwarded.split(",")[0].trim();
	}

	return req.socket.remoteAddress ?? "unknown";
};

export const sendInvalidId = (res: Response, resource = "resource") => {
	return res.status(400).json({
		success: false,
		code: "INVALID_ID",
		message: `Invalid ${resource} ID.`,
	});
};

export const enforceRateLimit = async ({
	key,
	maxAttempts,
	windowMS,
	res,
	message,
}: {
	key: string;
	maxAttempts: number;
	windowMS: number;
	res: Response;
	message: (retryAfterSec: number) => string;
}): Promise<boolean> => {
	const rateLimit = await checkRateLimit({ key, maxAttempts, windowMS });

	if (rateLimit.allowed) {
		return true;
	}

	const retryAfterSec = Math.ceil(rateLimit.retryAfterMS / 1000);
	res.status(429).json({
		success: false,
		code: "TOO_MANY_REQUESTS",
		message: message(retryAfterSec),
	});

	return false;
};
