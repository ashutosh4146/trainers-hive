import { pgTable, text } from "drizzle-orm/pg-core";

export const sessionStateTable = pgTable("session_state", {
  id: text("id").primaryKey(),
  activeUserId: text("active_user_id").notNull(),
});

export type SessionState = typeof sessionStateTable.$inferSelect;
