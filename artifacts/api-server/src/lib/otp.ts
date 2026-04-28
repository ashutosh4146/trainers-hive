const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

interface OtpEntry {
  otp: string;
  expiresAt: number;
  attempts: number;
}

const store = new Map<string, OtpEntry>();

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function createOtp(email: string): string {
  const otp = generateOtp();
  store.set(email.toLowerCase(), {
    otp,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });
  return otp;
}

export type VerifyResult = "valid" | "invalid" | "expired" | "too_many_attempts";

export function verifyOtp(email: string, otp: string): VerifyResult {
  const entry = store.get(email.toLowerCase());
  if (!entry) return "expired";
  if (Date.now() > entry.expiresAt) {
    store.delete(email.toLowerCase());
    return "expired";
  }
  if (entry.attempts >= MAX_ATTEMPTS) return "too_many_attempts";

  entry.attempts += 1;

  if (entry.otp !== otp.trim()) return "invalid";

  store.delete(email.toLowerCase());
  return "valid";
}

// Periodically clean up expired entries (runs every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.expiresAt) store.delete(key);
  }
}, 5 * 60 * 1000);
