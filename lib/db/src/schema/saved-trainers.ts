import { pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { vendorsTable } from "./vendors";
import { trainersTable } from "./trainers";

export const savedTrainersTable = pgTable(
  "saved_trainers",
  {
    id: text("id").primaryKey(),
    vendorId: text("vendor_id")
      .notNull()
      .references(() => vendorsTable.id, { onDelete: "cascade" }),
    trainerId: text("trainer_id")
      .notNull()
      .references(() => trainersTable.id, { onDelete: "cascade" }),
    savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqVendorTrainer: unique("saved_trainers_vendor_trainer_uniq").on(t.vendorId, t.trainerId),
  }),
);

export type SavedTrainer = typeof savedTrainersTable.$inferSelect;
