import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRouter from "../routes/authRoutes.js";
import productRouter from "../routes/productRoutes.js";
import uploadRouter from "../routes/uploadRoutes.js";
import orderRouter from "../routes/orderRoutes.js";
import { serve } from "inngest/express";
import { inngest, functions } from "../inngest/index.js";

const app = express();

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(
	cors({
		origin: process.env.CLIENT_URL || "http://localhost:5173",
		credentials: true,
	}),
);

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

// ─── Routes ──────────────────────────────────────────────────────────────────
app.get("/", (_req: Request, res: Response) => {
	res.json({ success: true, message: "Server is live" });
});

app.use("/api/auth", authRouter);
app.use("/api/products", productRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/orders", orderRouter);

// INNGEST
app.use("/api/inngest", serve({ client: inngest, functions }));

// ─── 404 — unknown route ──────────────────────────────────────────────────────────────────
app.use((_req, res) => {
	res.status(404).json({
		success: false,
		code: "NOT_FOUND",
		message: "The requested resource does not exist.",
	});
});

// ─── Global error handler ────────────────────────────────────────────────────
// Catches anything passed to next(error) or an unhandled throw in a route.
// Must have exactly 4 parameters — Express identifies it as an error handler
// by the function signature, not by name.
app.use((error: Error, _req: Request, res: Response, next: NextFunction) => {
	// Logging the full error server-side for debugging
	console.error("[GlobalErrorHandler]", error);

	const isDev = process.env.NODE_ENV === "development";
	res.status(500).json({
		success: false,
		code: "SERVER_ERROR",
		message: isDev ? error.message : "An unexpected error occurred.",
	});
});

export default app;
