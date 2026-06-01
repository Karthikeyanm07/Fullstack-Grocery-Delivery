import { prisma } from "../config/prisma.js";
/**
 * DB-backed rate limiter.
 *
 * Strategy:
 *  1. Delete any expired record for this key (resets the window cleanly).
 *  2. If no record exists → first attempt, create it and allow.
 *  3. If count >= max → block and return time remaining.
 *  4. Otherwise → increment and allow.
 */
export const checkRateLimit = async ({ key, maxAttempts, windowMS, }) => {
    const now = new Date();
    // Step 1 — purge expired record for this key so the window resets naturally
    await prisma.rateLimit.deleteMany({
        where: { key, expiresAt: { lt: now } },
    });
    // Step 2 — check current record
    const existing = await prisma.rateLimit.findUnique({ where: { key } });
    if (!existing) {
        // First attempt in this window
        await prisma.rateLimit.create({
            data: {
                key,
                count: 1,
                expiresAt: new Date(now.getTime() + windowMS),
            },
        });
        return { allowed: true, retryAfterMS: 0 };
    }
    // Step 3 — already at or over the limit
    if (existing.count >= maxAttempts) {
        return {
            allowed: false,
            retryAfterMS: existing.expiresAt.getTime() - now.getTime(),
        };
    }
    // Step 4 — within limit, increment
    await prisma.rateLimit.update({
        where: { key },
        data: {
            count: { increment: 1 },
        },
    });
    return { allowed: true, retryAfterMS: 0 };
};
