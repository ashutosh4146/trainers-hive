import type { Request } from "express";
import jwt from "jsonwebtoken";
import { db, sessionStateTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyIdToken } from "./firebase";

const SESSION_KEY = "default";

const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-secret-change-in-prod";
const APP_JWT_ISSUER = "trainers-hive-app";
export const APP_JWT_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

export class AccountDeactivatedError extends Error {
  constructor() {
    super("account_deactivated");
    this.name = "AccountDeactivatedError";
  }
}

export class UnauthenticatedError extends Error {
  constructor() {
    super("unauthenticated");
    this.name = "UnauthenticatedError";
  }
}

/**
 * Sign a short-lived app JWT for a given userId.
 * Used when Firebase custom-token exchange is unavailable in the client.
 */
export function signAppJwt(userId: string): string {
  return jwt.sign({ sub: userId }, SESSION_SECRET, {
    issuer: APP_JWT_ISSUER,
    expiresIn: APP_JWT_EXPIRY_SECONDS,
  });
}

const IS_PRODUCTION = process.env.NODE_ENV === "production";

export async function getActiveUserId(req?: Request): Promise<string> {
  if (req) {
    const authHeader = req.headers.authorization;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);

      // 1. Try Firebase ID token first
      try {
        const decoded = await verifyIdToken(token);
        const email = decoded.email;
        if (email) {
          const [user] = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.email, email))
            .limit(1);
          if (user) {
            if (user.deactivatedAt) throw new AccountDeactivatedError();
            return user.id;
          }
        }
      } catch (e) {
        if (e instanceof AccountDeactivatedError) throw e;
        // Not a valid Firebase token — fall through to app JWT
      }

      // 2. Try app-signed JWT
      try {
        const payload = jwt.verify(token, SESSION_SECRET, {
          issuer: APP_JWT_ISSUER,
        }) as jwt.JwtPayload;
        const userId = payload.sub;
        if (userId) {
          const [user] = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.id, userId))
            .limit(1);
          if (user) {
            if (user.deactivatedAt) throw new AccountDeactivatedError();
            return user.id;
          }
        }
      } catch (e) {
        if (e instanceof AccountDeactivatedError) throw e;
        // Invalid/expired app JWT — fall through
      }
    }
  }

  if (IS_PRODUCTION) {
    throw new UnauthenticatedError();
  }

  const rows = await db
    .select()
    .from(sessionStateTable)
    .where(eq(sessionStateTable.id, SESSION_KEY))
    .limit(1);
  const userId = rows.length === 0 ? "user-vendor" : rows[0]!.activeUserId;

  const [sessionUser] = await db
    .select({ deactivatedAt: usersTable.deactivatedAt })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (sessionUser?.deactivatedAt) throw new AccountDeactivatedError();

  return userId;
}

export async function setActiveUserId(userId: string): Promise<void> {
  await db
    .insert(sessionStateTable)
    .values({ id: SESSION_KEY, activeUserId: userId })
    .onConflictDoUpdate({
      target: sessionStateTable.id,
      set: { activeUserId: userId },
    });
}
