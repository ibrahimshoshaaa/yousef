import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { Role } from "@prisma/client";

export type AppSession = { userId: string; storeId: string; role: Role };

/** Authoritative authorization: never trust a client header or a role stored in a JWT. */
export async function requireAuth(): Promise<AppSession> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("UNAUTHORIZED");
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { id: true, storeId: true, role: true, status: true, store: { select: { status: true } } } });
  if (!user || user.status !== "ACTIVE" || user.store.status !== "ACTIVE") throw new Error("UNAUTHORIZED");
  return { userId: user.id, storeId: user.storeId, role: user.role };
}

export function getStoreId(session: AppSession): string { return session.storeId; }
