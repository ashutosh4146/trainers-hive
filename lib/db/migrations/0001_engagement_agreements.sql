-- Engagement agreements (digital click-wrap, IT Act 2000 compliant).
-- Apply once per environment (local + prod). Idempotent — safe to re-run.
CREATE TABLE IF NOT EXISTS engagement_agreements (
  id text PRIMARY KEY,
  application_id text NOT NULL,
  requirement_id text NOT NULL,
  vendor_id text NOT NULL,
  trainer_id text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  agreed_fee integer,
  fee_currency text NOT NULL DEFAULT 'INR',
  payment_schedule text,
  travel_boarding text,
  cancellation_notice text,
  start_date text,
  end_date text,
  sessions_count integer,
  location_or_mode text,
  deliverables text,
  confidentiality_clause boolean NOT NULL DEFAULT true,
  ip_ownership text,
  governing_law_city text NOT NULL DEFAULT 'Mumbai',
  special_clauses text,
  vendor_user_id text,
  vendor_accepted_at timestamptz,
  vendor_accepted_ip text,
  vendor_accepted_ua text,
  trainer_user_id text,
  trainer_accepted_at timestamptz,
  trainer_accepted_ip text,
  trainer_accepted_ua text,
  changes_requested_note text,
  cancelled_at timestamptz,
  cancelled_by_user_id text,
  cancellation_reason text,
  audit_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS engagement_agreements_application_unique
  ON engagement_agreements(application_id);
