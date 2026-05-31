import {
  db,
  engagementAgreementsTable,
  applicationsTable,
  requirementsTable,
  vendorsTable,
  trainersTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { newId } from "./ids";

/**
 * Idempotently creates a draft engagement agreement for a hired application.
 * Called when an application transitions to `hired` so the vendor lands on a
 * pre-populated draft instead of a blank "no agreement yet" state.
 *
 * Safe to call multiple times — the unique index on application_id prevents
 * duplicates; we look up first and only insert if missing.
 */
export async function ensureAgreementDraftForApplication(
  applicationId: string,
  actorUserId: string,
  actorRole: string,
): Promise<void> {
  const [existing] = await db
    .select({ id: engagementAgreementsTable.id })
    .from(engagementAgreementsTable)
    .where(eq(engagementAgreementsTable.applicationId, applicationId))
    .limit(1);
  if (existing) return;

  const [app] = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.id, applicationId))
    .limit(1);
  if (!app) return;
  const [reqRow] = await db
    .select()
    .from(requirementsTable)
    .where(eq(requirementsTable.id, app.requirementId))
    .limit(1);
  if (!reqRow) return;
  const [vendor] = await db
    .select()
    .from(vendorsTable)
    .where(eq(vendorsTable.id, reqRow.vendorId))
    .limit(1);
  if (!vendor) return;
  const [trainer] = await db
    .select()
    .from(trainersTable)
    .where(eq(trainersTable.id, app.trainerId))
    .limit(1);
  if (!trainer) return;

  const fee = app.proposedRate ?? (reqRow.budget > 0 ? reqRow.budget : null);
  const startIso = reqRow.startDate ? reqRow.startDate.slice(0, 10) : null;
  let endIso: string | null = null;
  if (startIso) {
    const d = new Date(`${startIso}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) {
      d.setUTCDate(d.getUTCDate() + Math.max(0, (reqRow.durationDays ?? 1) - 1));
      endIso = d.toISOString().slice(0, 10);
    }
  }
  const mode = reqRow.trainingMode || (reqRow.remote ? "remote" : "in-person");
  const locationOrMode = reqRow.location ? `${reqRow.location} (${mode})` : mode;
  const travelBoarding =
    reqRow.benefits === "ta-da"
      ? "Travel & boarding to be provided by the vendor."
      : reqRow.benefits === "stay-only"
        ? "Boarding to be provided by the vendor; travel borne by the trainer."
        : "Travel & boarding borne by the trainer unless otherwise agreed.";

  const now = new Date();
  try {
    await db.insert(engagementAgreementsTable).values({
      id: newId("eag"),
      applicationId,
      requirementId: reqRow.id,
      vendorId: vendor.id,
      trainerId: trainer.id,
      status: "draft",
      agreedFee: fee,
      feeCurrency: "INR",
      startDate: startIso,
      endDate: endIso,
      sessionsCount: reqRow.durationDays ?? null,
      locationOrMode,
      deliverables: reqRow.title,
      confidentialityClause: true,
      governingLawCity: "Mumbai",
      cancellationNotice: "Either party may cancel by giving 7 days written notice.",
      paymentSchedule: "50% on engagement start, 50% within 7 days of completion.",
      travelBoarding,
      ipOwnership:
        "Training material developed for this engagement remains the IP of the trainer; learner notes and recordings remain with the vendor.",
      auditLog: [
        {
          at: now.toISOString(),
          actorUserId,
          actorRole,
          action: "created_draft_on_hire",
        },
      ],
      createdAt: now,
      updatedAt: now,
    });
  } catch {
    // Race: another concurrent hire path inserted the row. Safe to ignore
    // because the unique index guarantees we still have exactly one draft.
  }
}
