import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { clearAuthCookie, sendAuthCookie } from "../utils/authCookie.js";
import {
	AUTH_TOKEN_EXPIRY,
	BCRYPT_ROUNDS,
	LOGIN_MAX_ATTEMPTS,
	LOGIN_WINDOW_MS,
	REGISTER_MAX_ATTEMPTS,
	REGISTER_WINDOW_MS,
} from "../constants/authConstants.js";
import { checkRateLimit } from "../utils/rateLimiter.js";

// ---------------------------------------------------------------------------
// Startup guard — fail loud if JWT_SECRET is missing or too short.
// This runs once when the module is first imported, not per-request.
// ---------------------------------------------------------------------------
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
	throw new Error(
		"JWT_SECRET environment variable must be set and at least 32 characters long.",
	);
}
// Generate JWT Token
const generateToken = (id: string): string => {
	return jwt.sign({ id }, JWT_SECRET, {
		expiresIn: AUTH_TOKEN_EXPIRY,
	});
};

// Normalizing Email
const normalizeEmail = (raw: unknown): string | null => {
	if (typeof raw !== "string") {
		return null;
	}

	const trimmed = raw.trim().toLowerCase();
	return trimmed.length > 0 ? trimmed : null;
};

// Check is "USER" isAdmin from the DB user record.
const buildSafeUser = (user: {
	id: string;
	name: string;
	email: string;
	isAdmin: boolean;
	createdAt: Date;
	addresses?: unknown[];
}) => {
	return {
		id: user.id,
		name: user.name,
		email: user.email,
		isAdmin: user.isAdmin,
		createdAt: user.createdAt,
		...(user.addresses !== undefined && { address: user.addresses }),
	};
};

// Extract client IP safely across proxies.
const getClientIP = (req: Request): string => {
	const forwarded = req.headers["x-forwarded-for"];

	if (typeof forwarded === "string") {
		return forwarded.split(",")[0].trim();
	}
	return req.socket.remoteAddress ?? "unknown";
};

// Register
// POST - /api/auth/resgister
export const register = async (req: Request, res: Response) => {
	try {
		const IP = getClientIP(req);

		const rateLimit = await checkRateLimit({
			key: `register:${IP}`,
			maxAttempts: REGISTER_MAX_ATTEMPTS,
			windowMS: REGISTER_WINDOW_MS,
		});
		if (rateLimit.allowed) {
			const retryAfterSec = Math.ceil(rateLimit.retryAfterMS / 1000);

			return res.status(429).json({
				success: false,
				code: "TOO_MANY_ATTEMPTS",
				message: `Too many registration attempts. Try again in ${retryAfterSec} seconds.`,
			});
		}

		const { name, email, password } = req.body as Record<string, unknown>;
		if (!name || !email || !password) {
			return res.status(400).json({
				success: false,
				code: "MISSING_FIELDS",
				message: "Please fill out all mandatory fields.",
			});
		}

		if (typeof name !== "string" || typeof password !== "string") {
			return res.status(400).json({
				success: false,
				code: "INVALID_INPUT",
				message: "Invalid input format.",
			});
		}

		const normalizedEmail = normalizeEmail(email);
		if (!normalizedEmail) {
			return res.status(400).json({
				success: false,
				code: "INVALID_EMAIL",
				message: "Please provide a valid email address",
			});
		}

		if (name.trim().length < 2 || name.trim().length > 100) {
			return res.status(400).json({
				success: false,
				code: "INVALID_NAME",
				message: "Name must be between 2 and 100 characters.",
			});
		}
		if (password.length < 8 || password.length > 128) {
			return res.status(400).json({
				success: false,
				code: "INVALID_PASSWORD",
				message: "Password must be between 8 and 128 characters.",
			});
		}

		const existingUser = await prisma.user.findUnique({
			where: { email: normalizedEmail },
		});
		if (existingUser) {
			return res.status(409).json({
				success: false,
				code: "EMAIL_ALREADY_EXISTS",
				message: "An account with this email already exists.",
			});
		}

		// Create User
		const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
		const user = await prisma.user.create({
			data: {
				name: name.trim(),
				email: normalizedEmail,
				password: hashedPassword,
			},
			select: {
				id: true,
				name: true,
				email: true,
				isAdmin: true,
				createdAt: true,
			},
		});

		const token = generateToken(user.id);
		sendAuthCookie(res, token);

		res.status(201).json({
			success: true,
			message: "Registration successful.",
			data: { user: buildSafeUser(user) },
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to Register due to an internal system error.",
		});
	}
};

// Login
// POST - /api/auth/login
export const login = async (req: Request, res: Response) => {
	try {
		const IP = getClientIP(req);
		const rateLimit = await checkRateLimit({
			key: `login:${IP}`,
			maxAttempts: LOGIN_MAX_ATTEMPTS,
			windowMS: LOGIN_WINDOW_MS,
		});

		if (!rateLimit.allowed) {
			const retryAfterSec = Math.ceil(rateLimit.retryAfterMS / 1000);
			return res.status(429).json({
				success: false,
				code: "TOO_MANY_REQUESTS",
				message: `Too many login attempts. Try again in ${retryAfterSec} seconds.`,
			});
		}
		const { email, password } = req.body as Record<string, unknown>;
		if (!email || !password) {
			return res.status(400).json({
				success: false,
				code: "MISSING_FIELDS",
				message: "Please provide email and password.",
			});
		}

		if (typeof password !== "string") {
			return res.status(400).json({
				success: false,
				code: "INVALID_INPUT",
				message: "Invalid input format.",
			});
		}

		const normalizedEmail = normalizeEmail(email);
		if (!normalizedEmail) {
			return res.status(400).json({
				success: false,
				code: "INVALID_INPUT",
				message: "Invalid input format.",
			});
		}

		const user = await prisma.user.findUnique({
			where: { email: normalizedEmail },
			select: {
				id: true,
				name: true,
				email: true,
				password: true, // needed for comparison only — stripped before response
				isAdmin: true,
				createdAt: true,
				addresses: true,
			},
		});

		// — Verify credentials —
		// IMPORTANT: always run bcrypt.compare even when the user doesn't exist.
		// Skipping it when user===null causes a measurable timing difference that
		// reveals whether an email is registered (user enumeration attack).
		const DUMMY_HASH =
			"$2b$12$invalidhashpaddingtomatchbcryptlengthandpreventearlyexit";
		const passwordToCompare = user?.password ?? DUMMY_HASH;
		const isMatch = await bcrypt.compare(password, passwordToCompare);

		if (!user || !isMatch) {
			return res.status(401).json({
				success: false,
				code: "PASSWORD_MISMATCH",
				message: "Invalid password.",
			});
		}

		const token = generateToken(user.id);
		sendAuthCookie(res, token);

		return res.status(200).json({
			success: true,
			message: "Login successful",
			data: {
				user: buildSafeUser(user),
			},
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to Login due to an internal system error.",
		});
	}
};

export const logout = (_req: Request, res: Response) => {
	// No try/catch needed — clearAuthCookie is synchronous and can't throw.
	clearAuthCookie(res);
	return res.status(200).json({
		success: true,
		message: "Logged out successfully.",
	});
};
