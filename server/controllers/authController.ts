import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { clearAuthCookie, sendAuthCookie } from "../utils/authCookie.js";
import {
	AUTH_TOKEN_EXPIRY,
	BCRYPT_ROUNDS,
	FORGOT_PASSWORD_MAX_ATTEMPTS,
	FORGOT_PASSWORD_WINDOW_MS,
	LOGIN_MAX_ATTEMPTS,
	LOGIN_WINDOW_MS,
	REGISTER_MAX_ATTEMPTS,
	REGISTER_WINDOW_MS,
	RESET_PASSWORD_MAX_ATTEMPTS,
	RESET_PASSWORD_WINDOW_MS,
	RESET_TOKEN_EXPIRY_MS,
} from "../utils/authConstants.js";
import { checkRateLimit } from "../utils/rateLimiter.js";
import { DUMMY_HASH, normalizeEmail } from "../utils/helper.js";
import crypto from "crypto";
import sendEmail, { isEmailConfigured } from "../config/nodemailer.js";

// * ─── Helpers ──────────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET as string;
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

// * ─── POST /api/auth/register ───────────────────────────────────────────────
export const register = async (req: Request, res: Response) => {
	try {
		const IP = getClientIP(req);

		const rateLimit = await checkRateLimit({
			key: `register:${IP}`,
			maxAttempts: REGISTER_MAX_ATTEMPTS,
			windowMS: REGISTER_WINDOW_MS,
		});
		if (!rateLimit.allowed) {
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

// * ─── POST /api/auth/login ───────────────────────────────────────────────
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
				password: true,
				isAdmin: true,
				createdAt: true,
				addresses: true,
			},
		});

		const passwordToCompare = user?.password ?? DUMMY_HASH;
		const isMatch = await bcrypt.compare(password, passwordToCompare);

		if (!user || !isMatch) {
			return res.status(401).json({
				success: false,
				code: "PASSWORD_MISMATCH",
				message: "Invalid email or password.",
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

export const forgotPassword = async (req: Request, res: Response) => {
	try {
		const ip = getClientIP(req);

		const rateLimit = await checkRateLimit({
			key: `forgot-password:${ip}`,
			maxAttempts: FORGOT_PASSWORD_MAX_ATTEMPTS,
			windowMS: FORGOT_PASSWORD_WINDOW_MS,
		});
		if (!rateLimit.allowed) {
			return res.status(429).json({
				success: false,
				code: "TOO_MANY_REQUESTS",
				message: `Too many attempts. Try again in ${Math.ceil(rateLimit.retryAfterMS / 1000)} seconds.`,
			});
		}

		const { email } = req.body as Record<string, unknown>;
		const normalizedEmail = normalizeEmail(email);
		if (!normalizedEmail) {
			return res.status(400).json({
				success: false,
				code: "INVALID_EMAIL",
				message: "Please provide a valid email address.",
			});
		}

		const user = await prisma.user.findUnique({
			where: { email: normalizedEmail },
			select: { id: true, name: true, email: true },
		});

		if (user) {
			const rawToken = crypto.randomBytes(32).toString("hex");

			const tokenHash = crypto
				.createHash("sha256")
				.update(rawToken)
				.digest("hex");

			const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

			// Upsert — if user already has a pending reset, replace it.
			// This prevents a user from accumulating multiple valid reset tokens.

			await prisma.passwordReset.upsert({
				where: { userId: user.id },
				create: { userId: user.id, tokenHash, expiresAt },
				update: { tokenHash, expiresAt }, // overwrite previous token
			});

			const clientUrl =
				process.env.CLIENT_URL ?? "http://localhost:5173";
			const resetUrl = `${clientUrl}/reset-password?token=${rawToken}`;

			if (isEmailConfigured()) {
				await sendEmail({
					to: user.email,
					subject: "Reset your password — Grocery Delivery",
					body: `
				<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: auto;
				  border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden;">
				  <div style="background: linear-gradient(135deg, #16a34a, #22c55e); padding: 24px 28px;">
					<h2 style="color: #fff; margin: 0; font-size: 20px;">Reset your password</h2>
				  </div>
				  <div style="padding: 28px;">
					<p style="margin: 0 0 16px; color: #374151;">Hi ${user.name},</p>
					<p style="margin: 0 0 24px; color: #374151;">
					  We received a request to reset your password. Click the button below.
					  This link expires in <strong>15 minutes</strong>.
					</p>
					<a href="${resetUrl}"
					  style="display: inline-block; background: #16a34a; color: #fff;
						padding: 12px 28px; border-radius: 8px; text-decoration: none;
						font-weight: 600; font-size: 15px;">
					  Reset Password
					</a>
					<p style="margin: 24px 0 0; font-size: 13px; color: #9ca3af;">
					  If you didn't request this, you can safely ignore this email.
					  Your password will not change.
					</p>
					<p style="margin: 8px 0 0; font-size: 12px; color: #d1d5db;">
					  Link not working? Copy this URL: ${resetUrl}
					</p>
				  </div>
				</div>
			  `,
				});
			} else {
				console.warn(
					"[forgotPassword] SMTP not configured (SMTP_USER, SMTP_PASS, SENDER_EMAIL). Reset link:",
					resetUrl,
				);
			}
		}

		// Always respond the same way — don't reveal whether the email exists.
		return res.status(200).json({
			success: true,
			message:
				"If an account exists for that email, a reset link has been sent.",
		});
	} catch (error) {
		console.error("[forgotPassword]", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to process request. Please try again.",
		});
	}
};

export const resetPassword = async (req: Request, res: Response) => {
	try {
		const ip = getClientIP(req);

		const rateLimit = await checkRateLimit({
			key: `reset-password:${ip}`,
			maxAttempts: RESET_PASSWORD_MAX_ATTEMPTS,
			windowMS: RESET_PASSWORD_WINDOW_MS,
		});
		if (!rateLimit.allowed) {
			return res.status(429).json({
				success: false,
				code: "TOO_MANY_REQUESTS",
				message: `Too many attempts. Try again in ${Math.ceil(rateLimit.retryAfterMS / 1000)} seconds.`,
			});
		}

		const { token, newPassword } = req.body as Record<string, unknown>;

		if (!token || typeof token !== "string") {
			return res.status(400).json({
				success: false,
				code: "MISSING_TOKEN",
				message: "Reset token is required.",
			});
		}

		if (!newPassword || typeof newPassword !== "string") {
			return res.status(400).json({
				success: false,
				code: "MISSING_PASSWORD",
				message: "New password is required.",
			});
		}

		if (newPassword.length < 8 || newPassword.length > 128) {
			return res.status(400).json({
				success: false,
				code: "INVALID_PASSWORD",
				message: "Password must be between 8 and 128 characters.",
			});
		}

		const tokenHash = crypto
			.createHash("sha256")
			.update(token)
			.digest("hex");

		const resetRecord = await prisma.passwordReset.findUnique({
			where: { tokenHash },
			include: {
				user: { select: { id: true, name: true, email: true } },
			},
		});

		if (!resetRecord || resetRecord.expiresAt < new Date()) {
			if (resetRecord) {
				await prisma.passwordReset.delete({ where: { tokenHash } });
			}
			return res.status(400).json({
				success: false,
				code: "INVALID_OR_EXPIRED_TOKEN",
				message:
					"This reset link is invalid or has expired. Please request a new one.",
			});
		}

		const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

		await prisma.$transaction([
			prisma.user.update({
				where: { id: resetRecord.userId },
				data: { password: hashedPassword },
			}),
			// Delete after use — token is now burned, cannot be reused
			prisma.passwordReset.delete({ where: { tokenHash } }),
		]);

		const jwt = await import("jsonwebtoken");
		const JWT_SECRET = process.env.JWT_SECRET as string;
		const authToken = jwt.default.sign(
			{ id: resetRecord.userId },
			JWT_SECRET,
			{ expiresIn: "7d" },
		);
		sendAuthCookie(res, authToken);

		return res.status(200).json({
			success: true,
			message: "Password reset successful. You are now logged in.",
			data: {
				user: {
					id: resetRecord.user.id,
					name: resetRecord.user.name,
					email: resetRecord.user.email,
				},
			},
		});
	} catch (error) {
		console.error("[resetPassword]", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to reset password. Please try again.",
		});
	}
};
