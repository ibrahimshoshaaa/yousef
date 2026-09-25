/**
 * Shopify's OAuth redirect lands the merchant's browser on our callback URL
 * with no session/cookies we control — so we can't use requireAuth() there.
 * Instead we hand Shopify a signed `state` value when we kick off the
 * install (see /api/shopify/install) that encodes which store initiated the
 * connection, and verify + decode it on the way back (see /api/shopify/callback).
 *
 * This is an HMAC-signed token (not encrypted — storeId isn't secret), so it
 * can't be forged or replayed for a different store, which is exactly what
 * `state` is for in the OAuth spec (CSRF protection).
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes — OAuth round trips are fast

type StatePayload = {
  storeId: string;
  nonce: string;
  issuedAt: number;
};

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createOAuthState(storeId: string, secret: string): string {
  const payload: StatePayload = {
    storeId,
    nonce: randomBytes(12).toString("hex"),
    issuedAt: Date.now(),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encoded, secret);
  return `${encoded}.${signature}`;
}

export function verifyOAuthState(state: string, secret: string): { storeId: string } | null {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: StatePayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (Date.now() - payload.issuedAt > STATE_TTL_MS) return null;
  if (!payload.storeId) return null;

  return { storeId: payload.storeId };
}
