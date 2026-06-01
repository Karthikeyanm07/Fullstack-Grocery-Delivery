import { AUTH_COOKIE_MAX_AGE_MS } from "../constants/authConstants.js";
// src/utils/cookieHelper.ts
import { Response } from "express";

const cookieBaseOptions = {
	httpOnly: true,
	secure: process.env.NODE_ENV === "production",
	sameSite: "strict" as const,
	path: "/",
};

/**
 * Attaches a signed auth token to the response as an HttpOnly cookie.
 */
export const sendAuthCookie = (res: Response, token: string): void => {
	res.cookie("token", token, {
		...cookieBaseOptions,
		maxAge: AUTH_COOKIE_MAX_AGE_MS,
	});
};

/**
 * Clears the auth cookie.
 * Options must match sendAuthCookie exactly — path, domain, secure — or
 * the browser will silently ignore the deletion.
 */
export const clearAuthCookie = (res: Response) => {
	res.cookie("token", "", {
		...cookieBaseOptions,
		expires: new Date(0), // Sets expiration date to past, erasing it instantly
	});
};
