import { createHmac } from "node:crypto";
import { db } from "@/lib/db";

const windowMs = 15 * 60 * 1000;
const limit = 10;
function key(email: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must contain at least 32 characters");
  return createHmac("sha256", secret).update(email.toLowerCase()).digest("hex");
}
export async function isLoginBlocked(email: string): Promise<boolean> {
  const record = await db.loginThrottle.findUnique({ where: { key: key(email) } });
  return !!record?.blockedUntil && record.blockedUntil > new Date();
}
export async function recordLoginFailure(email: string): Promise<void> {
  const hashed = key(email);
  const now = new Date();
  await db.$transaction(async tx => {
    const existing = await tx.loginThrottle.findUnique({ where: { key: hashed } });
    const failures = existing && now.getTime() - existing.windowStart.getTime() < windowMs ? existing.failures + 1 : 1;
    await tx.loginThrottle.upsert({ where: { key: hashed }, create: { key: hashed, failures: 1, windowStart: now }, update: { failures, windowStart: failures === 1 ? now : existing!.windowStart, blockedUntil: failures >= limit ? new Date(now.getTime() + windowMs) : null } });
  });
}
export async function clearLoginFailures(email: string): Promise<void> {
  await db.loginThrottle.deleteMany({ where: { key: key(email) } });
}
