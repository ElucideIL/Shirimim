import "server-only";
import crypto from "node:crypto";

/**
 * Endless-mode round tokens. Each round's answer track id is sealed into an
 * encrypted token handed to the browser. The client cannot read the id from
 * it (so guessing stays a real game), and the server recovers it to validate
 * guesses — no per-round DB row needed.
 */

let cachedKey: Buffer | null = null;

function key(): Buffer {
  if (cachedKey) return cachedKey;
  // Derive a 32-byte AES key from a high-entropy server-only secret.
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  cachedKey = crypto.createHash("sha256").update(secret).digest();
  return cachedKey;
}

/** Encrypt a track id into an opaque round token. */
export function sealTrackId(trackId: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(trackId, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

/** Recover the track id from a round token, or null if tampered/invalid. */
export function openTrackId(token: string): string | null {
  try {
    const raw = Buffer.from(token, "base64url");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const enc = raw.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}
