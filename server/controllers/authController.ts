import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { sendAuthCookie } from "../utils/authCookie.js";

// Generate JWT Token
const generateToken = (id: string): string => {
	return jwt.sign({ id }, process.env.JWT_SECRET as string, {
		expiresIn: "30d",
	});
};

// Check if "USER" is admin
const getAdminStatus = (email: string | null | undefined): boolean => {
	if (!email) {
		return false;
	}

	const adminEmails = process.env.ADMIN_EMAILS
		? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase())
		: [];

	return adminEmails.includes(email.toLowerCase());
};

// Register
// POST - /api/auth/resgister
export const register = async (req: Request, res: Response) => {
	try {
		const { name, email, password } = req.body;
		if (!name || !email || !password) {
			return res.status(400).json({
				success: false,
				code: "MISSING_FIELDS",
				message: "Please fill out all mandatory fields.",
			});
		}

		const normalizedEmail = email.toLowerCase().trim();

		const existingUser = await prisma.user.findUnique({
			where: { email: normalizedEmail },
		});
		if (existingUser) {
			return res.status(400).json({
				success: false,
				code: "EMAIL_ALREADY_EXISTS",
				message: "User already exists with this email.",
			});
		}

		const hashedPassword = await bcrypt.hash(password, 12);

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
				createdAt: true,
			},
		});

		const token = generateToken(user.id);
		sendAuthCookie(res, token);

		return res.status(201).json({
			success: true,
			message: "Registration successful!",
			data: {
				user: {
					...user,
					isAdmin: getAdminStatus(user.email),
				},
			},
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
		const { email, password } = req.body;
		if (!email || !password) {
			return res.status(400).json({
				success: false,
				code: "MISSING_FIELDS",
				message: "Please provide email and password.",
			});
		}

		const normalizedEmail = email.toLowerCase().trim();

		const user = await prisma.user.findUnique({
			where: { email: normalizedEmail },
			include: { addresses: true },
		});
		if (!user) {
			return res.status(401).json({
				success: false,
				code: "INVALID_CREDENTIALS",
				message: "Invalid email or password.",
			});
		}

		const isMatch = await bcrypt.compare(password, user.password);
		if (!isMatch) {
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
				user: {
					...user,
					isAdmin: getAdminStatus(user.email),
				},
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
