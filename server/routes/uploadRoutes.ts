import express, { Request, Response } from "express";
import auth from "../middleware/auth.js";
import multer from "multer";
import cloudinary from "../config/cloudinary.js";
import { checkRateLimit } from "../utils/rateLimiter.js";
import {
	UPLOAD_MAX_ATTEMPTS,
	UPLOAD_WINDOW_MS,
} from "../utils/authConstants.js";

const uploadRouter = express.Router();

// ── Multer configuration ─────────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
	fileFilter: (_req, file, cb) => {
		if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(new Error("INVALID_FILE_TYPE"));
		}
	},
});

// ── POST /api/upload ─────────────────────────────────────────────────────────
uploadRouter.post(
	"/",
	auth,
	upload.single("image"),
	async (req: Request, res: Response) => {
		try {
			const rateLimit = await checkRateLimit({
				key: `upload:${req.user!.id}`,
				maxAttempts: UPLOAD_MAX_ATTEMPTS,
				windowMS: UPLOAD_WINDOW_MS,
			});
			if (!rateLimit.allowed) {
				const retryAfterSec = Math.ceil(rateLimit.retryAfterMS / 1000);
				return res.status(429).json({
					success: false,
					code: "TOO_MANY_REQUESTS",
					message: `Upload limit reached. Try again in ${retryAfterSec} seconds.`,
				});
			}

			if (!req.file) {
				return res.status(400).json({
					success: false,
					code: "NO_FILE",
					message: "No image file provided.",
				});
			}

			const base64 = Buffer.from(req.file.buffer).toString("base64");
			const dataURI = `data:${req.file.mimetype};base64,${base64}`;

			const result = await cloudinary.uploader.upload(dataURI, {
				folder: "grocery-del",
				resource_type: "image",
			});

			return res.status(200).json({
				success: true,
				data: { url: result.secure_url },
			});
		} catch (error: any) {
			console.error("[upload]", error);
			return res.status(500).json({
				success: false,
				code: "UPLOAD_FAILED",
				message: "Image upload failed. Please try again.",
			});
		}
	},
);

// ── Multer error handler ─────────────────────────────────────────────────────
// Multer errors bypass try/catch and arrive here via next(error).
// Must be registered on the router with 4 params, not on app.
uploadRouter.use(
	(
		error: Error,
		_req: Request,
		res: Response,
		_next: express.NextFunction,
	) => {
		if (error.message === "INVALID_FILE_TYPE") {
			return res.status(400).json({
				success: false,
				code: "INVALID_FILE_TYPE",
				message: "Only JPEG, PNG, and WebP images are allowed.",
			});
		}

		if ((error as any).code === "LIMIT_FILE_SIZE") {
			return res.status(400).json({
				success: false,
				code: "FILE_TOO_LARGE",
				message: `File exceeds the ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB limit.`,
			});
		}

		console.error("[upload error handler]", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "An unexpected error occurred.",
		});
	},
);

export default uploadRouter;
