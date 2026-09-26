-- Enrich ops audit: where / which machine / impact / report pull + filters.

ALTER TABLE ops_audit_log ADD COLUMN ip_address TEXT;
ALTER TABLE ops_audit_log ADD COLUMN geo_label TEXT;
ALTER TABLE ops_audit_log ADD COLUMN device_label TEXT;
ALTER TABLE ops_audit_log ADD COLUMN machine_hint TEXT;
ALTER TABLE ops_audit_log ADD COLUMN impact TEXT;
ALTER TABLE ops_audit_log ADD COLUMN report_name TEXT;
ALTER TABLE ops_audit_log ADD COLUMN report_filters TEXT;

CREATE INDEX IF NOT EXISTS idx_ops_audit_actor_created_at
  ON ops_audit_log (actor_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_audit_report_created_at
  ON ops_audit_log (report_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_audit_resource_created_at
  ON ops_audit_log (resource_type, resource_id, created_at DESC);
