import { db, sessionStateTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const SESSION_KEY = "default";

export async function getActiveUserId(): Promise<string> {
  const rows = await db
    .select()
    .from(sessionStateTable)
    .where(eq(sessionStateTable.id, SESSION_KEY))
    .limit(1);
  if (rows.length === 0) {
    return "user-vendor";
  }
  return rows[0]!.activeUserId;
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
