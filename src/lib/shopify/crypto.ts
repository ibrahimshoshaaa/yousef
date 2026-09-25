/**
 * Symmetric encryption for the Shopify access token before it is written to
 * `Store.encryptedShopifyAccessToken`. AES-256-GCM via Node's built-in
 * `crypto` — no extra dependency needed.
 *
 * Key: SHOPIFY_TOKEN_ENCRYPTION_KEY, a base64-encoded 32-byte key
 * (`openssl rand -base64 32`). Never log or return the decrypted token to
 * the client — it only ever travels server-side into the Shopify API client.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended for GCM

function getKey(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) {
    throw new Error(
      "SHOPIFY_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (base64 of a 256-bit key)"
    );
  }
  return key;
}

/** Returns `iv:authTag:ciphertext`, all base64, colon-separated. */
export function encryptToken(plaintext: string, base64Key: string): string {
  const key = getKey(base64Key);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(
    ":"
  );
}

export function decryptToken(encrypted: string, base64Key: string): string {
  const key = getKey(base64Key);
  const [ivB64, authTagB64, ciphertextB64] = encrypted.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted Shopify token");
  }

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}
