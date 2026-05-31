-- Persist the finalized signed-agreement PDF in object storage so the
-- click-wrap evidence is stable (we no longer regenerate on every download).
ALTER TABLE engagement_agreements
  ADD COLUMN IF NOT EXISTS stored_pdf_key text,
  ADD COLUMN IF NOT EXISTS stored_pdf_at timestamptz;
