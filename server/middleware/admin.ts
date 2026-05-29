import { NextFunction, Request, Response } from "express";
import { prisma } from "../config/prisma.js";

const admin = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const userId = req.user?.id;
		if (!userId) {
			return res.status(401).json({
				success: false,
				code: "UNAUTHORIZED",
				message: "Authentication required.",
			});
		}

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { isAdmin: true },
		});
		if (!user) {
			return res.status(401).json({
				success: false,
				code: "USER_NOT_FOUND",
				message: "User account no longer exists.",
			});
		}

		if (!user.isAdmin) {
			return res.status(403).json({
				success: false,
				code: "FORBIDDEN",
				message: "Admin access required.",
			});
		}

		req.user!.isAdmin = true;
		next();
	} catch (error: any) {
		console.error("[admin middleware]", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "An unexpected error occurred.",
		});
	}
};

export default admin;
