import { pgTable, text, varchar, timestamp, unique } from "drizzle-orm/pg-core";
import { vendorsTable } from "./vendors";
import { trainersTable } from "./trainers";

export const endorsementsTable = pgTable(
  "endorsements",
  {
    id: text("id").primaryKey(),
    trainerId: text("trainer_id")
      .notNull()
      .references(() => trainersTable.id, { onDelete: "cascade" }),
    vendorId: text("vendor_id")
      .notNull()
      .references(() => vendorsTable.id, { onDelete: "cascade" }),
    text: varchar("text", { length: 300 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqTrainerVendor: unique("endorsements_trainer_vendor_uniq").on(
      t.trainerId,
      t.vendorId,
    ),
  }),
);

export type Endorsement = typeof endorsementsTable.$inferSelect;
