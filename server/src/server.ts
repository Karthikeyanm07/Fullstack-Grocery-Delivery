import app from "./app.js";

const port = process.env.PORT || 5000;

// Vercel runs the Express app via api/index.ts (serverless). Listen only for local dev.
if (!process.env.VERCEL) {
	app.listen(port, () => {
		console.log(`Server running at http://localhost:${port}`);
	});
}
