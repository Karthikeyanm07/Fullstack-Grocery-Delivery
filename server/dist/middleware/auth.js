import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET;
const auth = (req, res, next) => {
    try {
        const token = req.cookies?.token;
        if (!token) {
            return res.status(401).json({
                success: false,
                code: "NO_TOKEN",
                message: "Authentication required. Please log in.",
            });
        }
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = { id: decoded.id };
        next();
    }
    catch (error) {
        console.error("[auth middleware]", error);
        return res.status(401).json({
            success: false,
            code: "INVALID_TOKEN",
            message: "Session is invalid or expired. Please log in again.",
        });
    }
};
export default auth;
