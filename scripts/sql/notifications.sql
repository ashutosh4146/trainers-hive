-- Production notification setup for Trainers Hive.
-- Run once against the production Postgres database after deploying the app code.

CREATE TABLE IF NOT EXISTS notifications (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  type text NOT NULL,
  title text NOT NULL,
  body text,
  href text,
  entity_type text,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications(user_id, created_at);
CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS notifications_entity_idx ON notifications(entity_type, entity_id);

CREATE OR REPLACE FUNCTION th_notification_id()
RETURNS text AS $$
BEGIN
  RETURN 'notif_' || substr(md5(random()::text || clock_timestamp()::text), 1, 20);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION th_insert_notification(
  p_user_id text,
  p_type text,
  p_title text,
  p_body text,
  p_href text,
  p_entity_type text,
  p_entity_id text,
  p_metadata jsonb
)
RETURNS void AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO notifications(id, user_id, type, title, body, href, entity_type, entity_id, metadata)
  VALUES (th_notification_id(), p_user_id, p_type, p_title, p_body, p_href, p_entity_type, p_entity_id, COALESCE(p_metadata, '{}'::jsonb));
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION th_notify_application_insert()
RETURNS trigger AS $$
DECLARE
  req_row requirements%ROWTYPE;
  trainer_row trainers%ROWTYPE;
  vendor_user users%ROWTYPE;
BEGIN
  SELECT * INTO req_row FROM requirements WHERE id = NEW.requirement_id;
  SELECT * INTO trainer_row FROM trainers WHERE id = NEW.trainer_id;
  SELECT * INTO vendor_user FROM users WHERE vendor_id = req_row.vendor_id LIMIT 1;

  IF vendor_user.id IS NOT NULL THEN
    PERFORM th_insert_notification(
      vendor_user.id,
      'new_application_received',
      'New application received',
      COALESCE(trainer_row.name, 'A trainer') || ' applied for ' || COALESCE(req_row.title, 'your requirement') || '.',
      '/requirements/' || NEW.requirement_id,
      'application',
      NEW.id,
      jsonb_build_object('applicationId', NEW.id, 'requirementId', NEW.requirement_id, 'trainerId', NEW.trainer_id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_application_insert ON applications;
CREATE TRIGGER trg_notify_application_insert
AFTER INSERT ON applications
FOR EACH ROW EXECUTE FUNCTION th_notify_application_insert();

CREATE OR REPLACE FUNCTION th_notify_application_status_update()
RETURNS trigger AS $$
DECLARE
  req_row requirements%ROWTYPE;
  vendor_row vendors%ROWTYPE;
  trainer_user users%ROWTYPE;
  notif_type text;
  notif_title text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('shortlisted', 'hired', 'rejected', 'completed') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO req_row FROM requirements WHERE id = NEW.requirement_id;
  SELECT * INTO vendor_row FROM vendors WHERE id = req_row.vendor_id;
  SELECT * INTO trainer_user FROM users WHERE trainer_id = NEW.trainer_id LIMIT 1;

  notif_type := CASE
    WHEN NEW.status = 'shortlisted' THEN 'trainer_shortlisted'
    WHEN NEW.status = 'hired' THEN 'trainer_hired'
    ELSE 'new_application_received'
  END;

  notif_title := CASE
    WHEN NEW.status = 'shortlisted' THEN 'You were shortlisted'
    WHEN NEW.status = 'hired' THEN 'You were hired'
    WHEN NEW.status = 'completed' THEN 'Training completed'
    ELSE 'Application update'
  END;

  IF trainer_user.id IS NOT NULL THEN
    PERFORM th_insert_notification(
      trainer_user.id,
      notif_type,
      notif_title,
      COALESCE(vendor_row.company_name, 'The vendor') || ' updated your application for ' || COALESCE(req_row.title, 'a requirement') || ' to ' || NEW.status || '.',
      CASE WHEN NEW.status IN ('shortlisted', 'hired') THEN '/messages' ELSE '/requirements/' || NEW.requirement_id END,
      'application',
      NEW.id,
      jsonb_build_object('applicationId', NEW.id, 'requirementId', NEW.requirement_id, 'status', NEW.status)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_application_status_update ON applications;
CREATE TRIGGER trg_notify_application_status_update
AFTER UPDATE OF status ON applications
FOR EACH ROW EXECUTE FUNCTION th_notify_application_status_update();

CREATE OR REPLACE FUNCTION th_notify_requirement_update()
RETURNS trigger AS $$
DECLARE
  vendor_user users%ROWTYPE;
BEGIN
  SELECT * INTO vendor_user FROM users WHERE vendor_id = NEW.vendor_id LIMIT 1;

  IF vendor_user.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.hidden IS DISTINCT FROM NEW.hidden OR OLD.flagged IS DISTINCT FROM NEW.flagged THEN
    PERFORM th_insert_notification(
      vendor_user.id,
      CASE WHEN NEW.hidden OR NEW.flagged THEN 'requirement_rejected' ELSE 'requirement_approved' END,
      CASE WHEN NEW.hidden OR NEW.flagged THEN 'Requirement needs review' ELSE 'Requirement approved' END,
      CASE WHEN NEW.hidden OR NEW.flagged THEN COALESCE(NEW.flag_reason, NEW.title || ' needs admin review.') ELSE NEW.title || ' is live and visible to trainers.' END,
      '/requirements/' || NEW.id,
      'requirement',
      NEW.id,
      jsonb_build_object('requirementId', NEW.id, 'hidden', NEW.hidden, 'flagged', NEW.flagged)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_requirement_update ON requirements;
CREATE TRIGGER trg_notify_requirement_update
AFTER UPDATE OF hidden, flagged ON requirements
FOR EACH ROW EXECUTE FUNCTION th_notify_requirement_update();

CREATE OR REPLACE FUNCTION th_notify_agreement_accepted()
RETURNS trigger AS $$
DECLARE
  req_row requirements%ROWTYPE;
  vendor_user users%ROWTYPE;
  trainer_user users%ROWTYPE;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status OR NEW.status <> 'accepted' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO req_row FROM requirements WHERE id = NEW.requirement_id;
  SELECT * INTO vendor_user FROM users WHERE vendor_id = NEW.vendor_id LIMIT 1;
  SELECT * INTO trainer_user FROM users WHERE trainer_id = NEW.trainer_id LIMIT 1;

  PERFORM th_insert_notification(vendor_user.id, 'agreement_signed', 'Agreement signed', 'Agreement for ' || COALESCE(req_row.title, 'the engagement') || ' has been signed.', '/agreements', 'agreement', NEW.id, jsonb_build_object('agreementId', NEW.id));
  PERFORM th_insert_notification(trainer_user.id, 'agreement_signed', 'Agreement signed', 'Agreement for ' || COALESCE(req_row.title, 'the engagement') || ' has been signed.', '/agreements', 'agreement', NEW.id, jsonb_build_object('agreementId', NEW.id));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_agreement_accepted ON engagement_agreements;
CREATE TRIGGER trg_notify_agreement_accepted
AFTER UPDATE OF status ON engagement_agreements
FOR EACH ROW EXECUTE FUNCTION th_notify_agreement_accepted();

CREATE OR REPLACE FUNCTION th_notify_payment_insert()
RETURNS trigger AS $$
DECLARE
  ag_row engagement_agreements%ROWTYPE;
  req_row requirements%ROWTYPE;
  vendor_user users%ROWTYPE;
  trainer_user users%ROWTYPE;
BEGIN
  SELECT * INTO ag_row FROM engagement_agreements WHERE id = NEW.agreement_id;
  SELECT * INTO req_row FROM requirements WHERE id = ag_row.requirement_id;
  SELECT * INTO vendor_user FROM users WHERE vendor_id = ag_row.vendor_id LIMIT 1;
  SELECT * INTO trainer_user FROM users WHERE trainer_id = ag_row.trainer_id LIMIT 1;

  PERFORM th_insert_notification(vendor_user.id, 'payment_released', 'Payment recorded', 'Payment of ' || NEW.currency || ' ' || NEW.amount || ' was recorded for ' || COALESCE(req_row.title, 'the engagement') || '.', '/agreements', 'payment', NEW.id, jsonb_build_object('paymentId', NEW.id, 'agreementId', NEW.agreement_id, 'amount', NEW.amount));
  PERFORM th_insert_notification(trainer_user.id, 'payment_released', 'Payment recorded', 'Payment of ' || NEW.currency || ' ' || NEW.amount || ' was recorded for ' || COALESCE(req_row.title, 'the engagement') || '.', '/agreements', 'payment', NEW.id, jsonb_build_object('paymentId', NEW.id, 'agreementId', NEW.agreement_id, 'amount', NEW.amount));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_payment_insert ON agreement_payments;
CREATE TRIGGER trg_notify_payment_insert
AFTER INSERT ON agreement_payments
FOR EACH ROW EXECUTE FUNCTION th_notify_payment_insert();

CREATE OR REPLACE FUNCTION th_notify_trainer_verification()
RETURNS trigger AS $$
DECLARE
  trainer_user users%ROWTYPE;
BEGIN
  IF OLD.verified IS NOT DISTINCT FROM NEW.verified THEN
    RETURN NEW;
  END IF;

  SELECT * INTO trainer_user FROM users WHERE trainer_id = NEW.id LIMIT 1;
  PERFORM th_insert_notification(
    trainer_user.id,
    'profile_verification_update',
    CASE WHEN NEW.verified THEN 'Profile verified' ELSE 'Profile verification update' END,
    CASE WHEN NEW.verified THEN 'Your trainer profile is verified.' ELSE 'Your trainer profile verification status was updated.' END,
    '/profile',
    'trainer',
    NEW.id,
    jsonb_build_object('trainerId', NEW.id, 'verified', NEW.verified)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_trainer_verification ON trainers;
CREATE TRIGGER trg_notify_trainer_verification
AFTER UPDATE OF verified ON trainers
FOR EACH ROW EXECUTE FUNCTION th_notify_trainer_verification();

CREATE OR REPLACE FUNCTION th_notify_vendor_verification()
RETURNS trigger AS $$
DECLARE
  vendor_user users%ROWTYPE;
BEGIN
  IF OLD.verified IS NOT DISTINCT FROM NEW.verified THEN
    RETURN NEW;
  END IF;

  SELECT * INTO vendor_user FROM users WHERE vendor_id = NEW.id LIMIT 1;
  PERFORM th_insert_notification(
    vendor_user.id,
    'profile_verification_update',
    CASE WHEN NEW.verified THEN 'Profile verified' ELSE 'Profile verification update' END,
    CASE WHEN NEW.verified THEN 'Your organisation profile is verified.' ELSE 'Your organisation profile verification status was updated.' END,
    '/profile',
    'vendor',
    NEW.id,
    jsonb_build_object('vendorId', NEW.id, 'verified', NEW.verified)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_vendor_verification ON vendors;
CREATE TRIGGER trg_notify_vendor_verification
AFTER UPDATE OF verified ON vendors
FOR EACH ROW EXECUTE FUNCTION th_notify_vendor_verification();
