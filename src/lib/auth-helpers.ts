import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { Role } from "@prisma/client";
import { headers } from "next/headers";
import { hashMobileToken, parseMobileAuthorization } from "@/lib/mobile-token";

export type AppSession = { userId: string; storeId: string; role: Role };

/** Authoritative authorization: never trust a client header or a role stored in a JWT. */
export async function requireAuth(): Promise<AppSession> {
  const authorization = (await headers()).get("authorization");
  let userId: string | undefined;
  if (authorization !== null) {
    const token = parseMobileAuthorization(authorization);
    if (!token) throw new Error("UNAUTHORIZED");
    const mobileSession = await db.mobileSession.findUnique({
      where: { tokenHash: hashMobileToken(token) },
      select: { userId: true, expiresAt: true, revokedAt: true },
    });
    if (!mobileSession || mobileSession.revokedAt || mobileSession.expiresAt <= new Date()) throw new Error("UNAUTHORIZED");
    userId = mobileSession.userId;
  } else {
    const session = await auth();
    userId = session?.user?.id;
  }
  if (!userId) throw new Error("UNAUTHORIZED");
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, storeId: true, role: true, status: true, store: { select: { status: true } } } });
  if (!user || user.status !== "ACTIVE" || user.store.status !== "ACTIVE") throw new Error("UNAUTHORIZED");
  return { userId: user.id, storeId: user.storeId, role: user.role };
}

export function getStoreId(session: AppSession): string { return session.storeId; }
