import { NextFunction, Request, Response } from "express";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const allowedOrigins = new Set(
	[
		process.env.CLIENT_URL,
		"http://localhost:5173",
		"http://localhost:5174",
	]
		.filter((origin): origin is string => Boolean(origin))
		.map((origin) => origin.replace(/\/$/, "")),
);

export const securityHeaders = (
	_req: Request,
	res: Response,
	next: NextFunction,
) => {
	res.setHeader("X-Content-Type-Options", "nosniff");
	res.setHeader("X-Frame-Options", "DENY");
	res.setHeader("Referrer-Policy", "no-referrer");
	res.setHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
	next();
};

export const requireTrustedOrigin = (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	if (!unsafeMethods.has(req.method)) {
		return next();
	}

	const origin = req.headers.origin?.replace(/\/$/, "");
	if (!origin || allowedOrigins.has(origin)) {
		return next();
	}

	return res.status(403).json({
		success: false,
		code: "UNTRUSTED_ORIGIN",
		message: "Request origin is not allowed.",
	});
};
