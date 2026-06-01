import { AUTH_COOKIE_MAX_AGE_MS } from "../constants/authConstants.js";
const isProduction = process.env.NODE_ENV === "production";
const cookieBaseOptions = {
    httpOnly: true,
    secure: isProduction,
    // Cross-origin client (e.g. Vercel frontend) needs SameSite=None with Secure
    sameSite: (isProduction ? "none" : "strict"),
    path: "/",
};
/**
 * Attaches a signed auth token to the response as an HttpOnly cookie.
 */
export const sendAuthCookie = (res, token) => {
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
export const clearAuthCookie = (res) => {
    res.cookie("token", "", {
        ...cookieBaseOptions,
        expires: new Date(0), // Sets expiration date to past, erasing it instantly
    });
};
