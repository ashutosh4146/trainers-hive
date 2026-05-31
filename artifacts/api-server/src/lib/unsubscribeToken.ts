import { createHmac, timingSafeEqual } from "crypto";

export type UnsubPrefKey = "endorsements" | "applicationStatus" | "newRequirementMatch" | "messages";

const VALID_KEYS: UnsubPrefKey[] = ["endorsements", "applicationStatus", "newRequirementMatch", "messages"];

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function requireSecret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET;
  if (!s) {
    throw new Error("UNSUBSCRIBE_SECRET environment variable is required but not set.");
  }
  return s;
}

export function createUnsubscribeToken(trainerId: string, prefKey: UnsubPrefKey): string {
  const secret = requireSecret();
  const payload = JSON.stringify({ trainerId, prefKey, exp: Date.now() + TTL_MS });
  const encoded = Buffer.from(payload).toString("base64url");
  const sig = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyUnsubscribeToken(token: string): { trainerId: string; prefKey: UnsubPrefKey } | null {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) return null;

  const dotIdx = token.lastIndexOf(".");
  if (dotIdx === -1) return null;

  const encoded = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  const expectedSig = createHmac("sha256", secret).update(encoded).digest("base64url");

  try {
    const sigBuf = Buffer.from(sig, "base64url");
    const expBuf = Buffer.from(expectedSig, "base64url");
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
  } catch {
    return null;
  }

  let payload: { trainerId: string; prefKey: UnsubPrefKey; exp: number };
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
  if (!VALID_KEYS.includes(payload.prefKey)) return null;
  if (typeof payload.trainerId !== "string" || !payload.trainerId) return null;

  return { trainerId: payload.trainerId, prefKey: payload.prefKey };
}
