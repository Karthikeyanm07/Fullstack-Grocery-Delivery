// src/utils/cookieHelper.ts
import { Response } from "express";

const SEVEN_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Attaches a secure authentication token to the HTTP response cookie
 */
export const sendAuthCookie = (res: Response, token: string) => {
	res.cookie("token", token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "strict",
		maxAge: SEVEN_DAYS_MS,
	});
};

/**
 * Clears the authentication token cookie (Useful for Logout)
 */
export const clearAuthCookie = (res: Response) => {
	res.cookie("token", "", {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "strict",
		expires: new Date(0), // Sets expiration date to past, erasing it instantly
	});
};
