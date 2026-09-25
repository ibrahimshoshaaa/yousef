import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare, hashSync } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { isLoginBlocked, recordLoginFailure, clearLoginFailures } from "@/lib/login-throttle";

const credentialsSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(1024) });

const unknownUserHash = hashSync(randomBytes(32).toString("hex"), 12);

export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  providers: [Credentials({
    credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
    async authorize(raw) {
      const parsed = credentialsSchema.safeParse(raw);
      if (!parsed.success) return null;
      const email = parsed.data.email.trim().toLowerCase();
      if (await isLoginBlocked(email)) return null;
      const user = await db.user.findUnique({ where: { email }, include: { store: true } });
      // bcrypt comparison for unknown accounts keeps response behavior similar.
      const hash = user?.passwordHash ?? unknownUserHash;
      const valid = await compare(parsed.data.password, hash);
      if (!user || !valid || user.status !== "ACTIVE" || user.store.status !== "ACTIVE") { await recordLoginFailure(email); return null; }
      await clearLoginFailures(email);
      await db.auditLog.create({ data: { storeId: user.storeId, userId: user.id, action: "LOGIN", entity: "User", entityId: user.id } });
      return { id: user.id, email: user.email, name: user.name };
    },
  })],
  callbacks: {
    jwt({ token, user }) { if (user?.id) token.sub = user.id; return token; },
    session({ session, token }) { if (session.user && token.sub) session.user.id = token.sub; return session; },
  },
});
