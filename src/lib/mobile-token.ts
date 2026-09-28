import { createHash, randomBytes } from "node:crypto";

const tokenPattern = /^perf_[A-Za-z0-9_-]{43}$/;

export function createMobileToken(): string {
  return `perf_${randomBytes(32).toString("base64url")}`;
}

export function hashMobileToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function parseMobileAuthorization(value: string | null): string | null {
  if (!value) return null;
  const match = /^Bearer (\S+)$/.exec(value);
  return match && tokenPattern.test(match[1]) ? match[1] : null;
}
