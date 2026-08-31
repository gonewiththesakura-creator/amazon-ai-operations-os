BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE SCHEMA IF NOT EXISTS iam;
CREATE SCHEMA IF NOT EXISTS connectors;
CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS audit;

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'amazon_ai_app') THEN
    CREATE ROLE amazon_ai_app
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$roles$;

CREATE OR REPLACE FUNCTION iam.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION connectors.reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; create a new record instead', TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME
    USING ERRCODE = '55000';
END
$$;

CREATE TABLE iam.tenants (
  tenant_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_key text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CLOSED')),
  data_mode text NOT NULL DEFAULT 'SYNTHETIC'
    CHECK (data_mode IN ('SYNTHETIC', 'PRODUCTION')),
  default_marketplace text NOT NULL DEFAULT 'US',
  business_timezone text NOT NULL DEFAULT 'America/Los_Angeles',
  default_currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE iam.user_accounts (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  email_hash text NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('INVITED', 'ACTIVE', 'DISABLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id),
  UNIQUE (tenant_id, email_hash)
);

CREATE TABLE iam.roles (
  role_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  role_key text NOT NULL,
  name text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, role_id),
  UNIQUE (tenant_id, role_key)
);

CREATE TABLE iam.permissions (
  permission_key text PRIMARY KEY,
  description text NOT NULL,
  risk_level text NOT NULL DEFAULT 'LOW'
    CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'))
);

CREATE TABLE iam.role_permissions (
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  role_id uuid NOT NULL,
  permission_key text NOT NULL REFERENCES iam.permissions(permission_key),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, role_id, permission_key),
  FOREIGN KEY (tenant_id, role_id) REFERENCES iam.roles(tenant_id, role_id)
);

CREATE TABLE iam.user_role_bindings (
  binding_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  user_id uuid NOT NULL,
  role_id uuid NOT NULL,
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  UNIQUE (tenant_id, binding_id),
  UNIQUE (tenant_id, user_id, role_id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES iam.user_accounts(tenant_id, user_id),
  FOREIGN KEY (tenant_id, role_id) REFERENCES iam.roles(tenant_id, role_id),
  FOREIGN KEY (tenant_id, granted_by) REFERENCES iam.user_accounts(tenant_id, user_id),
  CHECK (expires_at IS NULL OR expires_at > granted_at)
);

CREATE TABLE connectors.marketplace_accounts (
  account_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  account_key text NOT NULL,
  marketplace text NOT NULL,
  seller_id_hash text,
  business_timezone text NOT NULL,
  default_currency text NOT NULL,
  status text NOT NULL DEFAULT 'SIMULATED'
    CHECK (status IN ('SIMULATED', 'DISCONNECTED', 'CONNECTED', 'DEGRADED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, account_id),
  UNIQUE (tenant_id, account_key, marketplace)
);

CREATE TABLE connectors.source_registry (
  source_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL UNIQUE,
  source_class text NOT NULL
    CHECK (source_class IN ('AMAZON', 'THIRD_PARTY', 'PUBLIC', 'USER_FILE', 'AI', 'SYNTHETIC')),
  connector_mode text NOT NULL
    CHECK (connector_mode IN ('READ_ONLY', 'WRITE_CAPABLE_DISABLED', 'LOCAL_GENERATOR')),
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE connectors.source_connections (
  connection_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  account_id uuid,
  source_id uuid NOT NULL REFERENCES connectors.source_registry(source_id),
  status text NOT NULL DEFAULT 'DISCONNECTED'
    CHECK (status IN ('SIMULATED', 'DISCONNECTED', 'CONNECTED', 'DEGRADED', 'DISABLED')),
  secret_reference text,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, connection_id),
  UNIQUE (tenant_id, account_id, source_id),
  FOREIGN KEY (tenant_id, account_id)
    REFERENCES connectors.marketplace_accounts(tenant_id, account_id),
  CHECK (secret_reference IS NULL OR secret_reference !~* '(password|token|secret)\\s*[=:]')
);

CREATE TABLE connectors.ingestion_runs (
  ingestion_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  connection_id uuid NOT NULL,
  dataset text NOT NULL,
  idempotency_key text NOT NULL,
  scenario_id text,
  window_start timestamptz,
  window_end timestamptz,
  status text NOT NULL
    CHECK (status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'DEFERRED')),
  synthetic boolean NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, ingestion_run_id),
  UNIQUE (connection_id, dataset, idempotency_key),
  FOREIGN KEY (tenant_id, connection_id)
    REFERENCES connectors.source_connections(tenant_id, connection_id),
  CHECK (window_end IS NULL OR window_start IS NULL OR window_end >= window_start),
  CHECK (finished_at IS NULL OR finished_at >= started_at)
);

CREATE TABLE connectors.raw_objects (
  raw_object_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  ingestion_run_id uuid NOT NULL,
  object_uri text NOT NULL,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  byte_count bigint NOT NULL CHECK (byte_count >= 0),
  content_type text NOT NULL,
  source_cursor text NOT NULL DEFAULT '',
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, raw_object_id),
  UNIQUE (ingestion_run_id, sha256, source_cursor),
  FOREIGN KEY (tenant_id, ingestion_run_id)
    REFERENCES connectors.ingestion_runs(tenant_id, ingestion_run_id)
);

CREATE TABLE connectors.data_provenance (
  provenance_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  ingestion_run_id uuid,
  raw_object_id uuid,
  source text NOT NULL,
  source_kind text NOT NULL
    CHECK (source_kind IN ('SYNTHETIC', 'LIVE_API', 'USER_UPLOAD', 'PUBLIC_WEB')),
  semantic_source_kind text NOT NULL
    CHECK (semantic_source_kind IN ('FIRST_PARTY', 'THIRD_PARTY_ESTIMATE', 'PUBLIC_OBSERVATION', 'USER_PROVIDED', 'AI_INFERENCE')),
  collected_at timestamptz NOT NULL,
  data_period_start timestamptz,
  data_period_end timestamptz,
  marketplace text NOT NULL,
  timezone text NOT NULL,
  currency text NOT NULL,
  grain text NOT NULL,
  attribution_window text NOT NULL,
  is_estimated boolean NOT NULL,
  confidence numeric(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  synthetic boolean NOT NULL,
  limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_record_reference text NOT NULL,
  source_schema_version text NOT NULL DEFAULT '1',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provenance_id),
  FOREIGN KEY (tenant_id, ingestion_run_id)
    REFERENCES connectors.ingestion_runs(tenant_id, ingestion_run_id),
  FOREIGN KEY (tenant_id, raw_object_id)
    REFERENCES connectors.raw_objects(tenant_id, raw_object_id),
  CHECK (data_period_end IS NULL OR data_period_start IS NULL OR data_period_end >= data_period_start),
  CHECK (
    (synthetic AND source_kind = 'SYNTHETIC') OR
    (NOT synthetic AND source_kind <> 'SYNTHETIC')
  ),
  CHECK (NOT is_estimated OR semantic_source_kind IN ('THIRD_PARTY_ESTIMATE', 'AI_INFERENCE', 'PUBLIC_OBSERVATION'))
);

CREATE TABLE connectors.quarantine_records (
  quarantine_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  raw_object_id uuid NOT NULL,
  record_locator text NOT NULL,
  error_code text NOT NULL,
  error_detail jsonb NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE (tenant_id, quarantine_id),
  FOREIGN KEY (tenant_id, raw_object_id)
    REFERENCES connectors.raw_objects(tenant_id, raw_object_id)
);

CREATE TABLE catalog.products (
  product_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  account_id uuid NOT NULL,
  marketplace text NOT NULL,
  asin text NOT NULL,
  sku_family text,
  title text NOT NULL,
  brand text,
  category text,
  lifecycle_status text NOT NULL DEFAULT 'ACTIVE'
    CHECK (lifecycle_status IN ('DRAFT', 'ACTIVE', 'SUPPRESSED', 'INACTIVE', 'ARCHIVED')),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, product_id),
  UNIQUE (tenant_id, marketplace, asin),
  FOREIGN KEY (tenant_id, account_id)
    REFERENCES connectors.marketplace_accounts(tenant_id, account_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK ((synthetic AND asin ~ '^SYN-ASIN-[0-9]{3,}$') OR NOT synthetic)
);

CREATE TABLE catalog.seller_skus (
  sku_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  account_id uuid NOT NULL,
  product_id uuid NOT NULL,
  marketplace text NOT NULL,
  seller_sku text NOT NULL,
  fnsku text,
  fulfillment_channel text NOT NULL
    CHECK (fulfillment_channel IN ('FBA', 'FBM')),
  status text NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sku_id),
  UNIQUE (tenant_id, account_id, marketplace, seller_sku),
  FOREIGN KEY (tenant_id, account_id)
    REFERENCES connectors.marketplace_accounts(tenant_id, account_id),
  FOREIGN KEY (tenant_id, product_id)
    REFERENCES catalog.products(tenant_id, product_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE catalog.objective_config_versions (
  objective_config_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  name text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  config jsonb NOT NULL,
  synthetic boolean NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, objective_config_version_id),
  UNIQUE (tenant_id, name, version),
  FOREIGN KEY (tenant_id, created_by)
    REFERENCES iam.user_accounts(tenant_id, user_id)
);

CREATE TABLE catalog.product_stage_history (
  stage_history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  product_id uuid NOT NULL,
  recommended_stage text CHECK (recommended_stage IN ('LAUNCH', 'SCALE', 'HARVEST', 'RECOVERY')),
  effective_stage text NOT NULL CHECK (effective_stage IN ('LAUNCH', 'SCALE', 'HARVEST', 'RECOVERY')),
  stage_confidence numeric(5,4) CHECK (stage_confidence BETWEEN 0 AND 1),
  stage_reasons jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(stage_reasons) = 'array'),
  manual_override boolean NOT NULL DEFAULT false,
  override_reason text,
  locked_by_user boolean NOT NULL DEFAULT true,
  confirmed_by_user_id uuid NOT NULL,
  confirmed_at timestamptz NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  objective_config_version_id uuid,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, stage_history_id),
  FOREIGN KEY (tenant_id, product_id)
    REFERENCES catalog.products(tenant_id, product_id),
  FOREIGN KEY (tenant_id, objective_config_version_id)
    REFERENCES catalog.objective_config_versions(tenant_id, objective_config_version_id),
  FOREIGN KEY (tenant_id, confirmed_by_user_id)
    REFERENCES iam.user_accounts(tenant_id, user_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (effective_to IS NULL OR effective_to > effective_from),
  CHECK (locked_by_user),
  CHECK ((manual_override AND override_reason IS NOT NULL) OR (NOT manual_override AND override_reason IS NULL)),
  CHECK (recommended_stage IS NOT NULL OR manual_override),
  EXCLUDE USING gist (
    tenant_id WITH =,
    product_id WITH =,
    tstzrange(effective_from, COALESCE(effective_to, 'infinity'::timestamptz), '[)') WITH &&
  )
);

CREATE OR REPLACE FUNCTION catalog.protect_effective_stage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.effective_stage IS DISTINCT FROM OLD.effective_stage OR
     NEW.confirmed_by_user_id IS DISTINCT FROM OLD.confirmed_by_user_id OR
     NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at THEN
    RAISE EXCEPTION 'effective stage is immutable; append a user-confirmed stage history row instead'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER product_stage_effective_immutable
BEFORE UPDATE OF effective_stage, confirmed_by_user_id, confirmed_at
ON catalog.product_stage_history
FOR EACH ROW EXECUTE FUNCTION catalog.protect_effective_stage();

CREATE TABLE audit.audit_events (
  audit_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  actor_type text NOT NULL CHECK (actor_type IN ('USER', 'SYSTEM', 'AI', 'WORKER')),
  actor_id uuid,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  request_id text,
  before_hash text,
  after_hash text,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  synthetic boolean NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, audit_event_id)
);

CREATE TRIGGER raw_objects_append_only
BEFORE UPDATE OR DELETE ON connectors.raw_objects
FOR EACH ROW EXECUTE FUNCTION connectors.reject_mutation();

CREATE TRIGGER data_provenance_append_only
BEFORE UPDATE OR DELETE ON connectors.data_provenance
FOR EACH ROW EXECUTE FUNCTION connectors.reject_mutation();

CREATE TRIGGER audit_events_append_only
BEFORE UPDATE OR DELETE ON audit.audit_events
FOR EACH ROW EXECUTE FUNCTION connectors.reject_mutation();

CREATE INDEX ingestion_runs_tenant_status_idx
  ON connectors.ingestion_runs (tenant_id, status, started_at DESC);
CREATE INDEX provenance_tenant_source_time_idx
  ON connectors.data_provenance (tenant_id, source, collected_at DESC);
CREATE INDEX product_stage_current_idx
  ON catalog.product_stage_history (tenant_id, product_id, effective_from DESC)
  WHERE effective_to IS NULL;
CREATE INDEX audit_events_tenant_time_idx
  ON audit.audit_events (tenant_id, occurred_at DESC);

DO $rls$
DECLARE
  target regclass;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'iam.user_accounts'::regclass,
    'iam.roles'::regclass,
    'iam.role_permissions'::regclass,
    'iam.user_role_bindings'::regclass,
    'connectors.marketplace_accounts'::regclass,
    'connectors.source_connections'::regclass,
    'connectors.ingestion_runs'::regclass,
    'connectors.raw_objects'::regclass,
    'connectors.data_provenance'::regclass,
    'connectors.quarantine_records'::regclass,
    'catalog.products'::regclass,
    'catalog.seller_skus'::regclass,
    'catalog.objective_config_versions'::regclass,
    'catalog.product_stage_history'::regclass,
    'audit.audit_events'::regclass
  ] LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', target);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', target);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %s TO amazon_ai_app USING (tenant_id = iam.current_tenant_id()) WITH CHECK (tenant_id = iam.current_tenant_id())',
      target
    );
  END LOOP;
END
$rls$;

GRANT USAGE ON SCHEMA iam, connectors, catalog, audit TO amazon_ai_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA iam, connectors, catalog, audit TO amazon_ai_app;
REVOKE INSERT, UPDATE, DELETE ON iam.permissions, connectors.source_registry FROM amazon_ai_app;
GRANT EXECUTE ON FUNCTION iam.current_tenant_id() TO amazon_ai_app;
GRANT EXECUTE ON FUNCTION catalog.protect_effective_stage() TO amazon_ai_app;

COMMIT;
