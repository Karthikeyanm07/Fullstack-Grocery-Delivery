import { AUTH_COOKIE_MAX_AGE_MS } from "./authConstants.js";
import { Response } from "express";

const isProduction = process.env.NODE_ENV === "production";

const cookieBaseOptions = {
	httpOnly: true,
	secure: isProduction,
	sameSite: (isProduction ? "none" : "strict") as "strict" | "none",
	path: "/",
};

export const sendAuthCookie = (res: Response, token: string): void => {
	res.cookie("token", token, {
		...cookieBaseOptions,
		maxAge: AUTH_COOKIE_MAX_AGE_MS,
	});
};

export const clearAuthCookie = (res: Response) => {
	res.cookie("token", "", {
		...cookieBaseOptions,
		expires: new Date(0),
	});
};

export const sendPartnerCookie = (res: Response, token: string): void => {
	res.cookie("partnerToken", token, {
		...cookieBaseOptions,
		maxAge: AUTH_COOKIE_MAX_AGE_MS,
	});
};

export const clearPartnerCookie = (res: Response): void => {
	res.cookie("partnerToken", "", {
		...cookieBaseOptions,
		expires: new Date(0),
	});
};
