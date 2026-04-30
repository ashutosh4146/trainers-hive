import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { applicationsTable } from "./applications";

export const messagesTable = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    applicationId: text("application_id")
      .notNull()
      .references(() => applicationsTable.id, { onDelete: "cascade" }),
    senderUserId: text("sender_user_id").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    appIdIdx: index("messages_application_id_idx").on(t.applicationId),
  }),
);

export type Message = typeof messagesTable.$inferSelect;
