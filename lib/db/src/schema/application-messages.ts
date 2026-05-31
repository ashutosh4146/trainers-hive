import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { applicationsTable } from "./applications";
import { usersTable } from "./users";

export const messagesTable = pgTable("application_messages", {
  id: text("id").primaryKey(),
  applicationId: text("application_id")
    .notNull()
    .references(() => applicationsTable.id, { onDelete: "cascade" }),
  senderUserId: text("sender_user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ApplicationMessage = typeof messagesTable.$inferSelect;
