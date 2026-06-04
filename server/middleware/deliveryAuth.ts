import jwt from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";
import { prisma } from "../config/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET as string;

const deliveryAuth = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		const token = req.cookies?.partnerToken as string | undefined;
		if (!token) {
			return res.status(401).json({
				success: false,
				code: "NO_TOKEN",
				message: "Authentication required. Please log in.",
			});
		}

		const decoded = jwt.verify(token, JWT_SECRET) as {
			id: string;
			role: string;
		};
		if (decoded.role !== "delivery") {
			return res.status(403).json({
				success: false,
				code: "FORBIDDEN",
				message: "Access restricted to delivery partners.",
			});
		}

		const partner = await prisma.deliveryPartner.findUnique({
			where: { id: decoded.id },
		});
		if (!partner) {
			return res.status(401).json({
				success: false,
				code: "PARTNER_NOT_FOUND",
				message: "Account no longer exists.",
			});
		}
		if (!partner.isActive) {
			return res.status(403).json({
				success: false,
				code: "ACCOUNT_DEACTIVATED",
				message: "Your account has been deactivated. Contact support.",
			});
		}

		req.partner = partner;
		next();
	} catch (error) {
		console.error("[deliveryAuth]", error);
		return res.status(401).json({
			success: false,
			code: "INVALID_TOKEN",
			message: "Session is invalid or expired. Please log in again.",
		});
	}
};

export default deliveryAuth;
