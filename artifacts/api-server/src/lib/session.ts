import type { Request } from "express";
import { db, sessionStateTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyIdToken } from "./firebase";

const SESSION_KEY = "default";

/**
 * Thrown when the resolved user's account has been deactivated by an admin.
 * Express 5 propagates unhandled async throws from route handlers to the
 * global error middleware, so callers don't need to handle this explicitly.
 */
export class AccountDeactivatedError extends Error {
  constructor() {
    super("account_deactivated");
    this.name = "AccountDeactivatedError";
  }
}

export async function getActiveUserId(req?: Request): Promise<string> {
  if (req) {
    const authHeader = req.headers.authorization;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
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
        // Invalid/expired token — fall through to shared session
      }
    }
  }

  const rows = await db
    .select()
    .from(sessionStateTable)
    .where(eq(sessionStateTable.id, SESSION_KEY))
    .limit(1);
  const userId = rows.length === 0 ? "user-vendor" : rows[0]!.activeUserId;

  // Also check deactivation for session-based users so that switching to a
  // deactivated account via /session/switch still triggers the guard.
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
