BEGIN;

CREATE SCHEMA IF NOT EXISTS selection;
CREATE SCHEMA IF NOT EXISTS sourcing;
CREATE SCHEMA IF NOT EXISTS logistics;

CREATE TABLE market.market_niches (
  market_niche_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  marketplace text NOT NULL,
  normalized_name text NOT NULL,
  display_name text NOT NULL,
  category_path text NOT NULL,
  price_band_low numeric(18,2) CHECK (price_band_low >= 0),
  price_band_high numeric(18,2) CHECK (price_band_high >= price_band_low),
  currency text NOT NULL,
  status text NOT NULL CHECK (status IN ('DISCOVERED', 'WATCHING', 'QUALIFIED', 'ARCHIVED')),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, market_niche_id),
  UNIQUE (tenant_id, marketplace, normalized_name),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE market.market_niche_snapshots (
  market_niche_snapshot_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  market_niche_id uuid NOT NULL,
  observed_at timestamptz NOT NULL,
  demand_index numeric(18,6) CHECK (demand_index >= 0),
  growth_rate numeric(12,8),
  concentration_index numeric(12,8) CHECK (concentration_index BETWEEN 0 AND 1),
  median_price numeric(18,2) CHECK (median_price >= 0),
  median_review_count integer CHECK (median_review_count >= 0),
  seasonality_index numeric(18,6) CHECK (seasonality_index >= 0),
  estimated_units_low numeric(20,6) CHECK (estimated_units_low >= 0),
  estimated_units_high numeric(20,6) CHECK (estimated_units_high >= estimated_units_low),
  currency text NOT NULL,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, market_niche_snapshot_id),
  UNIQUE (tenant_id, market_niche_id, observed_at, provenance_id),
  FOREIGN KEY (tenant_id, market_niche_id) REFERENCES market.market_niches(tenant_id, market_niche_id),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE market.product_opportunities (
  product_opportunity_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  market_niche_id uuid NOT NULL,
  opportunity_code text NOT NULL,
  title text NOT NULL,
  hypothesis text NOT NULL,
  status text NOT NULL CHECK (status IN ('DISCOVERED', 'WATCHING', 'QUALIFIED', 'PROMOTED', 'DISMISSED', 'ARCHIVED')),
  first_detected_at timestamptz NOT NULL,
  last_detected_at timestamptz NOT NULL,
  confidence numeric(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, product_opportunity_id),
  UNIQUE (tenant_id, opportunity_code),
  FOREIGN KEY (tenant_id, market_niche_id) REFERENCES market.market_niches(tenant_id, market_niche_id),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (last_detected_at >= first_detected_at)
);

CREATE TABLE market.public_market_observations (
  public_market_observation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  platform text NOT NULL,
  external_content_ref text NOT NULL,
  canonical_url text NOT NULL,
  observed_at timestamptz NOT NULL,
  observation_type text NOT NULL,
  observation_payload jsonb NOT NULL,
  license_use_note text NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('PUBLIC_WEB', 'SYNTHETIC')),
  semantic_source_kind text NOT NULL CHECK (semantic_source_kind = 'PUBLIC_OBSERVATION'),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, public_market_observation_id),
  UNIQUE (tenant_id, platform, external_content_ref, observed_at),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK ((synthetic AND source_kind = 'SYNTHETIC') OR (NOT synthetic AND source_kind = 'PUBLIC_WEB')),
  CHECK (NOT (observation_payload ?| ARRAY['orders', 'ad_sales', 'profit', 'amazon_attributed_sales']))
);

CREATE TABLE market.opportunity_evidence (
  opportunity_evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  product_opportunity_id uuid NOT NULL,
  public_market_observation_id uuid,
  evidence_type text NOT NULL,
  source_reference text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  metric_name text,
  metric_value numeric(24,8),
  unit text NOT NULL,
  is_estimated boolean NOT NULL,
  confidence numeric(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  evidence_direction text NOT NULL CHECK (evidence_direction IN ('SUPPORTS', 'CHALLENGES', 'NEUTRAL')),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, opportunity_evidence_id),
  FOREIGN KEY (tenant_id, product_opportunity_id) REFERENCES market.product_opportunities(tenant_id, product_opportunity_id),
  FOREIGN KEY (tenant_id, public_market_observation_id) REFERENCES market.public_market_observations(tenant_id, public_market_observation_id),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (period_end >= period_start)
);

ALTER TABLE market.creative_signals
  ADD COLUMN public_market_observation_id uuid,
  ADD COLUMN content_ref text,
  ADD COLUMN topic text,
  ADD COLUMN format text,
  ADD COLUMN region text;

ALTER TABLE market.creative_signals
  ADD CONSTRAINT creative_signals_public_observation_fk
  FOREIGN KEY (tenant_id, public_market_observation_id)
  REFERENCES market.public_market_observations(tenant_id, public_market_observation_id);

CREATE TABLE selection.candidate_score_versions (
  candidate_score_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  version integer NOT NULL CHECK (version > 0),
  name text NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  normalization_rules jsonb NOT NULL,
  weight_checksum text NOT NULL CHECK (weight_checksum ~ '^[0-9a-f]{64}$'),
  code_reference text NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT', 'PUBLISHED', 'RETIRED')),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, candidate_score_version_id),
  UNIQUE (tenant_id, version),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE TABLE selection.candidate_products (
  candidate_product_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  marketplace text NOT NULL,
  product_opportunity_id uuid NOT NULL,
  market_niche_id uuid NOT NULL,
  candidate_code text NOT NULL,
  project_name text NOT NULL,
  current_stage text NOT NULL CHECK (current_stage IN (
    'DISCOVERED', 'PRELIMINARY_RESEARCH', 'DEEP_VALIDATION', 'PENDING_APPROVAL',
    'SUPPLIER_SEARCH', 'SAMPLING', 'COST_CONFIRMED', 'SMALL_BATCH_PURCHASE',
    'LISTING_PREPARATION', 'LAUNCH_TEST', 'APPROVED_FOR_SCALE', 'REJECTED'
  )),
  owner_user_id uuid,
  active boolean NOT NULL DEFAULT true,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, candidate_product_id),
  UNIQUE (tenant_id, marketplace, candidate_code),
  FOREIGN KEY (tenant_id, product_opportunity_id) REFERENCES market.product_opportunities(tenant_id, product_opportunity_id),
  FOREIGN KEY (tenant_id, market_niche_id) REFERENCES market.market_niches(tenant_id, market_niche_id),
  FOREIGN KEY (tenant_id, owner_user_id) REFERENCES iam.user_accounts(tenant_id, user_id),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE selection.candidate_product_snapshots (
  candidate_product_snapshot_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  candidate_product_id uuid NOT NULL,
  observed_at timestamptz NOT NULL,
  product_concept jsonb NOT NULL,
  benchmark_asin_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  target_price numeric(18,2) CHECK (target_price >= 0),
  estimated_weight_kg numeric(18,6) CHECK (estimated_weight_kg >= 0),
  estimated_volume_m3 numeric(18,8) CHECK (estimated_volume_m3 >= 0),
  raw_demand_metrics jsonb NOT NULL,
  raw_competition_metrics jsonb NOT NULL,
  currency text NOT NULL,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, candidate_product_snapshot_id),
  UNIQUE (tenant_id, candidate_product_id, observed_at, provenance_id),
  FOREIGN KEY (tenant_id, candidate_product_id) REFERENCES selection.candidate_products(tenant_id, candidate_product_id),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE selection.candidate_evaluations (
  candidate_evaluation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  candidate_product_id uuid NOT NULL,
  candidate_score_version_id uuid NOT NULL,
  evaluated_at timestamptz NOT NULL,
  overall_score numeric(9,6) NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  decision text NOT NULL CHECK (decision IN ('ADVANCE', 'HOLD', 'REJECT', 'NEEDS_RESEARCH')),
  summary text NOT NULL,
  open_verifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  calculation_run_ref text NOT NULL,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, candidate_evaluation_id),
  UNIQUE (tenant_id, candidate_product_id, candidate_score_version_id, evaluated_at),
  FOREIGN KEY (tenant_id, candidate_product_id) REFERENCES selection.candidate_products(tenant_id, candidate_product_id),
  FOREIGN KEY (tenant_id, candidate_score_version_id) REFERENCES selection.candidate_score_versions(tenant_id, candidate_score_version_id),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE selection.candidate_score_dimensions (
  candidate_score_dimension_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  candidate_evaluation_id uuid NOT NULL,
  dimension_code text NOT NULL,
  raw_metrics jsonb NOT NULL,
  normalized_score numeric(9,6) NOT NULL CHECK (normalized_score BETWEEN 0 AND 100),
  weight numeric(9,8) NOT NULL CHECK (weight BETWEEN 0 AND 1),
  weighted_score numeric(12,8) NOT NULL,
  source_evidence_refs jsonb NOT NULL,
  is_estimated boolean NOT NULL,
  confidence numeric(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  penalty_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  manual_verification_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, candidate_score_dimension_id),
  UNIQUE (tenant_id, candidate_evaluation_id, dimension_code),
  FOREIGN KEY (tenant_id, candidate_evaluation_id) REFERENCES selection.candidate_evaluations(tenant_id, candidate_evaluation_id),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (abs(weighted_score - normalized_score * weight) < 0.000001)
);

CREATE TABLE selection.candidate_risks (
  candidate_risk_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  candidate_product_id uuid NOT NULL,
  candidate_evaluation_id uuid,
  risk_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  likelihood numeric(5,4) CHECK (likelihood BETWEEN 0 AND 1),
  evidence_refs jsonb NOT NULL,
  mitigation text NOT NULL,
  status text NOT NULL CHECK (status IN ('OPEN', 'MITIGATING', 'ACCEPTED', 'CLOSED')),
  verified_by uuid,
  verified_at timestamptz,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, candidate_risk_id),
  FOREIGN KEY (tenant_id, candidate_product_id) REFERENCES selection.candidate_products(tenant_id, candidate_product_id),
  FOREIGN KEY (tenant_id, candidate_evaluation_id) REFERENCES selection.candidate_evaluations(tenant_id, candidate_evaluation_id),
  FOREIGN KEY (tenant_id, verified_by) REFERENCES iam.user_accounts(tenant_id, user_id),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK ((verified_by IS NULL AND verified_at IS NULL) OR (verified_by IS NOT NULL AND verified_at IS NOT NULL))
);

CREATE TABLE selection.candidate_differentiation_ideas (
  differentiation_idea_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  candidate_product_id uuid NOT NULL,
  idea text NOT NULL,
  target_pain_point_ref text NOT NULL,
  evidence_refs jsonb NOT NULL,
  feasibility text NOT NULL CHECK (feasibility IN ('UNKNOWN', 'LOW', 'MEDIUM', 'HIGH')),
  confidence numeric(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  status text NOT NULL CHECK (status IN ('PROPOSED', 'VALIDATING', 'ACCEPTED', 'REJECTED')),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, differentiation_idea_id),
  FOREIGN KEY (tenant_id, candidate_product_id) REFERENCES selection.candidate_products(tenant_id, candidate_product_id),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE selection.candidate_research_tasks (
  candidate_research_task_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  candidate_product_id uuid NOT NULL,
  task_type text NOT NULL,
  question text NOT NULL,
  owner_user_id uuid,
  due_at timestamptz,
  status text NOT NULL CHECK (status IN ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  result_summary text,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed_at timestamptz,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, candidate_research_task_id),
  FOREIGN KEY (tenant_id, candidate_product_id) REFERENCES selection.candidate_products(tenant_id, candidate_product_id),
  FOREIGN KEY (tenant_id, owner_user_id) REFERENCES iam.user_accounts(tenant_id, user_id),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK ((status = 'COMPLETED' AND completed_at IS NOT NULL AND result_summary IS NOT NULL) OR status <> 'COMPLETED')
);

CREATE TABLE selection.candidate_project_stage_history (
  candidate_project_stage_history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  candidate_product_id uuid NOT NULL,
  sequence_number integer NOT NULL CHECK (sequence_number > 0),
  from_stage text,
  to_stage text NOT NULL,
  changed_at timestamptz NOT NULL,
  changed_by uuid NOT NULL,
  reason text NOT NULL,
  approval_ref text,
  evidence_refs jsonb NOT NULL,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, candidate_project_stage_history_id),
  UNIQUE (tenant_id, candidate_product_id, sequence_number),
  FOREIGN KEY (tenant_id, candidate_product_id) REFERENCES selection.candidate_products(tenant_id, candidate_product_id),
  FOREIGN KEY (tenant_id, changed_by) REFERENCES iam.user_accounts(tenant_id, user_id),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE selection.candidate_rejection_reasons (
  candidate_rejection_reason_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  candidate_product_id uuid NOT NULL,
  rejected_at timestamptz NOT NULL,
  rejected_by uuid NOT NULL,
  reason_code text NOT NULL,
  detail text NOT NULL,
  evidence_refs jsonb NOT NULL CHECK (jsonb_array_length(evidence_refs) > 0),
  reconsideration_condition text,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, candidate_rejection_reason_id),
  FOREIGN KEY (tenant_id, candidate_product_id) REFERENCES selection.candidate_products(tenant_id, candidate_product_id),
  FOREIGN KEY (tenant_id, rejected_by) REFERENCES iam.user_accounts(tenant_id, user_id),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE OR REPLACE FUNCTION selection.require_rejection_reason()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.current_stage = 'REJECTED' AND NOT EXISTS (
    SELECT 1 FROM selection.candidate_rejection_reasons reason
    WHERE reason.tenant_id = NEW.tenant_id AND reason.candidate_product_id = NEW.candidate_product_id
  ) THEN
    RAISE EXCEPTION 'Rejected candidate % must have evidence-backed rejection reason', NEW.candidate_product_id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;

CREATE CONSTRAINT TRIGGER candidate_rejection_requires_reason
AFTER INSERT OR UPDATE OF current_stage ON selection.candidate_products
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION selection.require_rejection_reason();

CREATE TABLE sourcing.suppliers (
  supplier_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  supplier_code text NOT NULL,
  legal_name text NOT NULL,
  country_region text NOT NULL,
  status text NOT NULL CHECK (status IN ('PROSPECT', 'QUALIFIED', 'ACTIVE', 'BLOCKED', 'INACTIVE')),
  business_reference_hash text,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, supplier_id),
  UNIQUE (tenant_id, supplier_code),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE sourcing.supplier_contacts (
  supplier_contact_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  supplier_id uuid NOT NULL,
  display_name_encrypted text NOT NULL,
  role text NOT NULL,
  contact_fields_encrypted jsonb NOT NULL,
  preferred_channel text,
  active boolean NOT NULL DEFAULT true,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, supplier_contact_id),
  FOREIGN KEY (tenant_id, supplier_id) REFERENCES sourcing.suppliers(tenant_id, supplier_id),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE sourcing.supplier_products (
  supplier_product_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  supplier_id uuid NOT NULL,
  candidate_product_id uuid,
  product_id uuid,
  supplier_sku text NOT NULL,
  moq integer NOT NULL CHECK (moq > 0),
  lead_time_days integer NOT NULL CHECK (lead_time_days >= 0),
  specification jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('PROPOSED', 'SAMPLED', 'QUALIFIED', 'INACTIVE')),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, supplier_product_id),
  UNIQUE (tenant_id, supplier_id, supplier_sku),
  FOREIGN KEY (tenant_id, supplier_id) REFERENCES sourcing.suppliers(tenant_id, supplier_id),
  FOREIGN KEY (tenant_id, candidate_product_id) REFERENCES selection.candidate_products(tenant_id, candidate_product_id),
  FOREIGN KEY (tenant_id, product_id) REFERENCES catalog.products(tenant_id, product_id),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (num_nonnulls(candidate_product_id, product_id) >= 1)
);

CREATE TABLE sourcing.supplier_quotes (
  supplier_quote_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  supplier_id uuid NOT NULL,
  candidate_product_id uuid,
  product_id uuid,
  quote_number text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  quoted_at date NOT NULL,
  valid_until date,
  currency text NOT NULL,
  moq integer NOT NULL CHECK (moq > 0),
  quantity_tiers jsonb NOT NULL,
  unit_price numeric(18,6) NOT NULL CHECK (unit_price >= 0),
  sample_terms text,
  payment_terms text NOT NULL,
  incoterm text NOT NULL,
  document_id uuid,
  confirmed_field_id uuid,
  field_confirmation_status text NOT NULL DEFAULT 'CONFIRMED' CHECK (field_confirmation_status = 'CONFIRMED'),
  confirmation_status text NOT NULL CHECK (confirmation_status IN ('UNCONFIRMED', 'CONFIRMED', 'REJECTED')),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, supplier_quote_id),
  UNIQUE (tenant_id, supplier_id, quote_number, version),
  FOREIGN KEY (tenant_id, supplier_id) REFERENCES sourcing.suppliers(tenant_id, supplier_id),
  FOREIGN KEY (tenant_id, candidate_product_id) REFERENCES selection.candidate_products(tenant_id, candidate_product_id),
  FOREIGN KEY (tenant_id, product_id) REFERENCES catalog.products(tenant_id, product_id),
  FOREIGN KEY (tenant_id, document_id) REFERENCES procurement.documents(tenant_id, document_id),
  FOREIGN KEY (tenant_id, confirmed_field_id, field_confirmation_status)
    REFERENCES procurement.document_extracted_fields(tenant_id, field_id, confirmation_status),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (num_nonnulls(candidate_product_id, product_id) >= 1),
  CHECK (valid_until IS NULL OR valid_until >= quoted_at),
  CHECK (confirmation_status <> 'CONFIRMED' OR confirmed_field_id IS NOT NULL)
);

CREATE TABLE sourcing.contracts (
  contract_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  supplier_id uuid NOT NULL,
  contract_number text NOT NULL,
  amount numeric(18,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL,
  signed_at date,
  effective_from date NOT NULL,
  effective_to date,
  payment_terms text NOT NULL,
  document_id uuid,
  confirmed_field_id uuid,
  field_confirmation_status text NOT NULL DEFAULT 'CONFIRMED' CHECK (field_confirmation_status = 'CONFIRMED'),
  confirmation_status text NOT NULL CHECK (confirmation_status IN ('UNCONFIRMED', 'CONFIRMED', 'REJECTED')),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, contract_id),
  UNIQUE (tenant_id, supplier_id, contract_number),
  FOREIGN KEY (tenant_id, supplier_id) REFERENCES sourcing.suppliers(tenant_id, supplier_id),
  FOREIGN KEY (tenant_id, document_id) REFERENCES procurement.documents(tenant_id, document_id),
  FOREIGN KEY (tenant_id, confirmed_field_id, field_confirmation_status)
    REFERENCES procurement.document_extracted_fields(tenant_id, field_id, confirmation_status),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CHECK (confirmation_status <> 'CONFIRMED' OR confirmed_field_id IS NOT NULL)
);

CREATE TABLE sourcing.purchase_orders (
  purchase_order_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  supplier_id uuid NOT NULL,
  contract_id uuid,
  po_number text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  order_date date NOT NULL,
  currency text NOT NULL,
  total_amount numeric(18,2) NOT NULL CHECK (total_amount >= 0),
  deposit_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
  balance_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (balance_amount >= 0),
  status text NOT NULL CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED_NOT_SENT', 'SENT', 'IN_PRODUCTION', 'SHIPPED', 'CANCELLED', 'CLOSED')),
  expected_ship_date date,
  expected_arrival_date date,
  document_id uuid,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, purchase_order_id),
  UNIQUE (tenant_id, po_number, version),
  FOREIGN KEY (tenant_id, supplier_id) REFERENCES sourcing.suppliers(tenant_id, supplier_id),
  FOREIGN KEY (tenant_id, contract_id) REFERENCES sourcing.contracts(tenant_id, contract_id),
  FOREIGN KEY (tenant_id, document_id) REFERENCES procurement.documents(tenant_id, document_id),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (expected_arrival_date IS NULL OR expected_ship_date IS NULL OR expected_arrival_date >= expected_ship_date),
  CHECK (deposit_amount + balance_amount <= total_amount)
);

CREATE TABLE sourcing.purchase_order_items (
  purchase_order_item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  purchase_order_id uuid NOT NULL,
  supplier_product_id uuid NOT NULL,
  product_id uuid,
  sku_id uuid,
  candidate_product_id uuid,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(18,6) NOT NULL CHECK (unit_price >= 0),
  currency text NOT NULL,
  line_total numeric(18,2) NOT NULL CHECK (line_total >= 0),
  received_quantity integer NOT NULL DEFAULT 0 CHECK (received_quantity >= 0 AND received_quantity <= quantity),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, purchase_order_item_id),
  FOREIGN KEY (tenant_id, purchase_order_id) REFERENCES sourcing.purchase_orders(tenant_id, purchase_order_id),
  FOREIGN KEY (tenant_id, supplier_product_id) REFERENCES sourcing.supplier_products(tenant_id, supplier_product_id),
  FOREIGN KEY (tenant_id, product_id) REFERENCES catalog.products(tenant_id, product_id),
  FOREIGN KEY (tenant_id, sku_id) REFERENCES catalog.seller_skus(tenant_id, sku_id),
  FOREIGN KEY (tenant_id, candidate_product_id) REFERENCES selection.candidate_products(tenant_id, candidate_product_id),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (num_nonnulls(product_id, sku_id, candidate_product_id) >= 1)
);

CREATE TABLE sourcing.supplier_payments (
  supplier_payment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  supplier_id uuid NOT NULL,
  transfer_date date NOT NULL,
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL,
  payment_type text NOT NULL CHECK (payment_type IN ('DEPOSIT', 'BALANCE', 'OTHER')),
  proof_document_id uuid,
  confirmed_field_id uuid,
  field_confirmation_status text NOT NULL DEFAULT 'CONFIRMED' CHECK (field_confirmation_status = 'CONFIRMED'),
  confirmation_status text NOT NULL CHECK (confirmation_status IN ('UNCONFIRMED', 'CONFIRMED', 'REJECTED')),
  payment_reference_hash text NOT NULL,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, supplier_payment_id),
  UNIQUE (tenant_id, payment_reference_hash),
  FOREIGN KEY (tenant_id, supplier_id) REFERENCES sourcing.suppliers(tenant_id, supplier_id),
  FOREIGN KEY (tenant_id, proof_document_id) REFERENCES procurement.documents(tenant_id, document_id),
  FOREIGN KEY (tenant_id, confirmed_field_id, field_confirmation_status)
    REFERENCES procurement.document_extracted_fields(tenant_id, field_id, confirmation_status),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (confirmation_status <> 'CONFIRMED' OR confirmed_field_id IS NOT NULL)
);

CREATE TABLE sourcing.payment_allocations (
  payment_allocation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  supplier_payment_id uuid NOT NULL,
  contract_id uuid,
  purchase_order_id uuid,
  allocated_amount numeric(18,2) NOT NULL CHECK (allocated_amount > 0),
  currency text NOT NULL,
  allocation_date date NOT NULL,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, payment_allocation_id),
  FOREIGN KEY (tenant_id, supplier_payment_id) REFERENCES sourcing.supplier_payments(tenant_id, supplier_payment_id),
  FOREIGN KEY (tenant_id, contract_id) REFERENCES sourcing.contracts(tenant_id, contract_id),
  FOREIGN KEY (tenant_id, purchase_order_id) REFERENCES sourcing.purchase_orders(tenant_id, purchase_order_id),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (num_nonnulls(contract_id, purchase_order_id) = 1)
);

CREATE OR REPLACE FUNCTION sourcing.enforce_payment_allocation_balance()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE payment_amount numeric(18,2); allocated_total numeric(18,2);
BEGIN
  SELECT amount INTO payment_amount FROM sourcing.supplier_payments
  WHERE tenant_id = NEW.tenant_id AND supplier_payment_id = NEW.supplier_payment_id AND confirmation_status = 'CONFIRMED';
  SELECT COALESCE(sum(allocated_amount), 0) INTO allocated_total FROM sourcing.payment_allocations
  WHERE tenant_id = NEW.tenant_id AND supplier_payment_id = NEW.supplier_payment_id;
  IF payment_amount IS NULL OR allocated_total > payment_amount THEN
    RAISE EXCEPTION 'Payment allocation requires a confirmed payment and cannot exceed its amount' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;

CREATE CONSTRAINT TRIGGER payment_allocation_balance
AFTER INSERT OR UPDATE ON sourcing.payment_allocations
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION sourcing.enforce_payment_allocation_balance();

CREATE TABLE sourcing.sample_orders (
  sample_order_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  candidate_product_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  supplier_quote_id uuid,
  ordered_at date NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  amount numeric(18,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL,
  status text NOT NULL CHECK (status IN ('ORDERED', 'IN_TRANSIT', 'RECEIVED', 'EVALUATED', 'CANCELLED')),
  expected_date date,
  received_date date,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sample_order_id),
  FOREIGN KEY (tenant_id, candidate_product_id) REFERENCES selection.candidate_products(tenant_id, candidate_product_id),
  FOREIGN KEY (tenant_id, supplier_id) REFERENCES sourcing.suppliers(tenant_id, supplier_id),
  FOREIGN KEY (tenant_id, supplier_quote_id) REFERENCES sourcing.supplier_quotes(tenant_id, supplier_quote_id),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (received_date IS NULL OR received_date >= ordered_at)
);

CREATE TABLE sourcing.sample_evaluations (
  sample_evaluation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  sample_order_id uuid NOT NULL,
  evaluated_at timestamptz NOT NULL,
  evaluated_by uuid NOT NULL,
  dimension_scores jsonb NOT NULL,
  defects jsonb NOT NULL DEFAULT '[]'::jsonb,
  photo_document_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  decision text NOT NULL CHECK (decision IN ('PASS', 'FAIL', 'REVISE', 'RETEST')),
  follow_up text,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sample_evaluation_id),
  FOREIGN KEY (tenant_id, sample_order_id) REFERENCES sourcing.sample_orders(tenant_id, sample_order_id),
  FOREIGN KEY (tenant_id, evaluated_by) REFERENCES iam.user_accounts(tenant_id, user_id),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE logistics.logistics_shipments (
  logistics_shipment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  supplier_id uuid NOT NULL,
  purchase_order_id uuid NOT NULL,
  shipment_code text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('SEA', 'AIR', 'RAIL', 'TRUCK', 'COURIER', 'MULTIMODAL')),
  carrier_reference_hash text,
  ship_date date,
  estimated_arrival date,
  actual_arrival date,
  origin text NOT NULL,
  destination text NOT NULL,
  status text NOT NULL CHECK (status IN ('PLANNED', 'BOOKED', 'IN_TRANSIT', 'CUSTOMS', 'DELIVERED', 'DELAYED', 'CANCELLED')),
  currency text NOT NULL,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, logistics_shipment_id),
  UNIQUE (tenant_id, shipment_code),
  FOREIGN KEY (tenant_id, supplier_id) REFERENCES sourcing.suppliers(tenant_id, supplier_id),
  FOREIGN KEY (tenant_id, purchase_order_id) REFERENCES sourcing.purchase_orders(tenant_id, purchase_order_id),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (actual_arrival IS NULL OR ship_date IS NULL OR actual_arrival >= ship_date)
);

CREATE TABLE logistics.logistics_shipment_items (
  logistics_shipment_item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  logistics_shipment_id uuid NOT NULL,
  purchase_order_item_id uuid NOT NULL,
  sku_id uuid,
  candidate_product_id uuid,
  quantity_shipped integer NOT NULL CHECK (quantity_shipped > 0),
  quantity_received integer NOT NULL DEFAULT 0 CHECK (quantity_received >= 0 AND quantity_received <= quantity_shipped),
  cartons integer CHECK (cartons > 0),
  weight_kg numeric(18,6) CHECK (weight_kg >= 0),
  volume_m3 numeric(18,8) CHECK (volume_m3 >= 0),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, logistics_shipment_item_id),
  FOREIGN KEY (tenant_id, logistics_shipment_id) REFERENCES logistics.logistics_shipments(tenant_id, logistics_shipment_id),
  FOREIGN KEY (tenant_id, purchase_order_item_id) REFERENCES sourcing.purchase_order_items(tenant_id, purchase_order_item_id),
  FOREIGN KEY (tenant_id, sku_id) REFERENCES catalog.seller_skus(tenant_id, sku_id),
  FOREIGN KEY (tenant_id, candidate_product_id) REFERENCES selection.candidate_products(tenant_id, candidate_product_id),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (num_nonnulls(sku_id, candidate_product_id) >= 1)
);

CREATE TABLE logistics.inventory_batches (
  inventory_batch_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  batch_code text NOT NULL,
  logistics_shipment_id uuid NOT NULL,
  sku_id uuid,
  product_id uuid,
  candidate_product_id uuid,
  received_at timestamptz,
  quantity integer NOT NULL CHECK (quantity > 0),
  remaining_quantity integer NOT NULL CHECK (remaining_quantity >= 0 AND remaining_quantity <= quantity),
  cost_version_id uuid,
  status text NOT NULL CHECK (status IN ('EXPECTED', 'RECEIVED', 'AVAILABLE', 'DEPLETED', 'QUARANTINED')),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, inventory_batch_id),
  UNIQUE (tenant_id, batch_code),
  FOREIGN KEY (tenant_id, logistics_shipment_id) REFERENCES logistics.logistics_shipments(tenant_id, logistics_shipment_id),
  FOREIGN KEY (tenant_id, sku_id) REFERENCES catalog.seller_skus(tenant_id, sku_id),
  FOREIGN KEY (tenant_id, product_id) REFERENCES catalog.products(tenant_id, product_id),
  FOREIGN KEY (tenant_id, candidate_product_id) REFERENCES selection.candidate_products(tenant_id, candidate_product_id),
  FOREIGN KEY (tenant_id, cost_version_id) REFERENCES finance.product_cost_versions(tenant_id, cost_version_id),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (num_nonnulls(sku_id, product_id, candidate_product_id) >= 1)
);

CREATE TABLE logistics.customs_costs (
  customs_cost_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  logistics_shipment_id uuid NOT NULL,
  cost_type text NOT NULL CHECK (cost_type IN ('DUTY', 'TAX', 'BROKERAGE', 'INSPECTION', 'OTHER')),
  amount numeric(18,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL,
  document_id uuid,
  confirmation_status text NOT NULL CHECK (confirmation_status IN ('UNCONFIRMED', 'CONFIRMED', 'REJECTED')),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, customs_cost_id),
  FOREIGN KEY (tenant_id, logistics_shipment_id) REFERENCES logistics.logistics_shipments(tenant_id, logistics_shipment_id),
  FOREIGN KEY (tenant_id, document_id) REFERENCES procurement.documents(tenant_id, document_id),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE logistics.freight_costs (
  freight_cost_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  logistics_shipment_id uuid NOT NULL,
  cost_type text NOT NULL CHECK (cost_type IN ('FREIGHT', 'INSURANCE', 'HANDLING', 'PORT', 'DRAYAGE', 'OTHER')),
  amount numeric(18,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL,
  document_id uuid,
  confirmation_status text NOT NULL CHECK (confirmation_status IN ('UNCONFIRMED', 'CONFIRMED', 'REJECTED')),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, freight_cost_id),
  FOREIGN KEY (tenant_id, logistics_shipment_id) REFERENCES logistics.logistics_shipments(tenant_id, logistics_shipment_id),
  FOREIGN KEY (tenant_id, document_id) REFERENCES procurement.documents(tenant_id, document_id),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE sourcing.packaging_costs (
  packaging_cost_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  supplier_product_id uuid,
  product_id uuid,
  candidate_product_id uuid,
  packaging_type text NOT NULL,
  quantity_basis integer NOT NULL CHECK (quantity_basis > 0),
  amount numeric(18,6) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  confirmation_status text NOT NULL CHECK (confirmation_status IN ('UNCONFIRMED', 'CONFIRMED', 'REJECTED')),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, packaging_cost_id),
  FOREIGN KEY (tenant_id, supplier_product_id) REFERENCES sourcing.supplier_products(tenant_id, supplier_product_id),
  FOREIGN KEY (tenant_id, product_id) REFERENCES catalog.products(tenant_id, product_id),
  FOREIGN KEY (tenant_id, candidate_product_id) REFERENCES selection.candidate_products(tenant_id, candidate_product_id),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (num_nonnulls(supplier_product_id, product_id, candidate_product_id) >= 1),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE logistics.landed_cost_allocations (
  landed_cost_allocation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  inventory_batch_id uuid NOT NULL,
  logistics_shipment_id uuid NOT NULL,
  cost_type text NOT NULL,
  source_cost_type text NOT NULL,
  source_cost_id uuid NOT NULL,
  allocation_method text NOT NULL CHECK (allocation_method IN ('UNITS', 'WEIGHT', 'VOLUME', 'VALUE', 'MANUAL')),
  allocated_amount numeric(18,6) NOT NULL CHECK (allocated_amount >= 0),
  currency text NOT NULL,
  allocated_unit_cost numeric(18,8) NOT NULL CHECK (allocated_unit_cost >= 0),
  version integer NOT NULL CHECK (version > 0),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, landed_cost_allocation_id),
  UNIQUE (tenant_id, inventory_batch_id, cost_type, source_cost_id, version),
  FOREIGN KEY (tenant_id, inventory_batch_id) REFERENCES logistics.inventory_batches(tenant_id, inventory_batch_id),
  FOREIGN KEY (tenant_id, logistics_shipment_id) REFERENCES logistics.logistics_shipments(tenant_id, logistics_shipment_id),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE procurement.document_entity_links (
  document_entity_link_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  document_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  relationship text NOT NULL,
  linked_by uuid NOT NULL,
  linked_at timestamptz NOT NULL DEFAULT now(),
  confirmation_status text NOT NULL CHECK (confirmation_status IN ('UNCONFIRMED', 'CONFIRMED', 'REJECTED')),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, document_entity_link_id),
  UNIQUE (tenant_id, document_id, entity_type, entity_id, relationship),
  FOREIGN KEY (tenant_id, document_id) REFERENCES procurement.documents(tenant_id, document_id),
  FOREIGN KEY (tenant_id, linked_by) REFERENCES iam.user_accounts(tenant_id, user_id),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE finance.product_cost_scenarios (
  product_cost_scenario_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  candidate_product_id uuid,
  product_id uuid,
  version integer NOT NULL CHECK (version > 0),
  quantity integer NOT NULL CHECK (quantity > 0),
  purchase_amount numeric(18,6) NOT NULL CHECK (purchase_amount >= 0),
  freight_amount numeric(18,6) CHECK (freight_amount >= 0),
  duty_amount numeric(18,6) CHECK (duty_amount >= 0),
  packaging_amount numeric(18,6) CHECK (packaging_amount >= 0),
  other_amount numeric(18,6) NOT NULL DEFAULT 0 CHECK (other_amount >= 0),
  source_currency text NOT NULL,
  reporting_currency text NOT NULL,
  fx_assumptions jsonb NOT NULL,
  unit_landed_cost numeric(18,8),
  contribution_margin numeric(18,8),
  break_even_acos numeric(12,8),
  confidence numeric(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  status text NOT NULL CHECK (status IN ('DRAFT', 'PARTIAL', 'UNCONFIRMED', 'COMPLETE', 'SUPERSEDED')),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, product_cost_scenario_id),
  UNIQUE (tenant_id, candidate_product_id, product_id, version),
  FOREIGN KEY (tenant_id, candidate_product_id) REFERENCES selection.candidate_products(tenant_id, candidate_product_id),
  FOREIGN KEY (tenant_id, product_id) REFERENCES catalog.products(tenant_id, product_id),
  FOREIGN KEY (tenant_id, provenance_id) REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (num_nonnulls(candidate_product_id, product_id) = 1),
  CHECK (break_even_acos IS NULL OR break_even_acos BETWEEN 0 AND 1),
  CHECK (status <> 'COMPLETE' OR (
    freight_amount IS NOT NULL AND duty_amount IS NOT NULL AND packaging_amount IS NOT NULL AND
    unit_landed_cost IS NOT NULL AND contribution_margin IS NOT NULL AND break_even_acos IS NOT NULL
  )),
  CHECK (status = 'COMPLETE' OR break_even_acos IS NULL)
);

CREATE TRIGGER market_niche_snapshots_append_only
BEFORE UPDATE OR DELETE ON market.market_niche_snapshots
FOR EACH ROW EXECUTE FUNCTION connectors.reject_mutation();
CREATE TRIGGER candidate_product_snapshots_append_only
BEFORE UPDATE OR DELETE ON selection.candidate_product_snapshots
FOR EACH ROW EXECUTE FUNCTION connectors.reject_mutation();
CREATE TRIGGER candidate_score_versions_append_only
BEFORE UPDATE OR DELETE ON selection.candidate_score_versions
FOR EACH ROW EXECUTE FUNCTION connectors.reject_mutation();
CREATE TRIGGER candidate_project_stage_history_append_only
BEFORE UPDATE OR DELETE ON selection.candidate_project_stage_history
FOR EACH ROW EXECUTE FUNCTION connectors.reject_mutation();
CREATE TRIGGER landed_cost_allocations_append_only
BEFORE UPDATE OR DELETE ON logistics.landed_cost_allocations
FOR EACH ROW EXECUTE FUNCTION connectors.reject_mutation();

CREATE INDEX market_niche_snapshot_time_idx ON market.market_niche_snapshots (tenant_id, market_niche_id, observed_at DESC);
CREATE INDEX candidate_stage_updated_idx ON selection.candidate_products (tenant_id, current_stage, updated_at DESC);
CREATE INDEX rejection_reason_lookup_idx ON selection.candidate_rejection_reasons (tenant_id, reason_code, rejected_at DESC);
CREATE INDEX supplier_quotes_candidate_idx ON sourcing.supplier_quotes (tenant_id, candidate_product_id, quoted_at DESC);
CREATE INDEX sourcing_po_supplier_date_idx ON sourcing.purchase_orders (tenant_id, supplier_id, order_date DESC);
CREATE INDEX logistics_shipment_status_eta_idx ON logistics.logistics_shipments (tenant_id, status, estimated_arrival);

DO $rls$
DECLARE target regclass;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'market.market_niches'::regclass,
    'market.market_niche_snapshots'::regclass,
    'market.product_opportunities'::regclass,
    'market.opportunity_evidence'::regclass,
    'market.public_market_observations'::regclass,
    'selection.candidate_score_versions'::regclass,
    'selection.candidate_products'::regclass,
    'selection.candidate_product_snapshots'::regclass,
    'selection.candidate_evaluations'::regclass,
    'selection.candidate_score_dimensions'::regclass,
    'selection.candidate_risks'::regclass,
    'selection.candidate_differentiation_ideas'::regclass,
    'selection.candidate_research_tasks'::regclass,
    'selection.candidate_project_stage_history'::regclass,
    'selection.candidate_rejection_reasons'::regclass,
    'sourcing.suppliers'::regclass,
    'sourcing.supplier_contacts'::regclass,
    'sourcing.supplier_products'::regclass,
    'sourcing.supplier_quotes'::regclass,
    'sourcing.contracts'::regclass,
    'sourcing.purchase_orders'::regclass,
    'sourcing.purchase_order_items'::regclass,
    'sourcing.supplier_payments'::regclass,
    'sourcing.payment_allocations'::regclass,
    'sourcing.sample_orders'::regclass,
    'sourcing.sample_evaluations'::regclass,
    'sourcing.packaging_costs'::regclass,
    'logistics.logistics_shipments'::regclass,
    'logistics.logistics_shipment_items'::regclass,
    'logistics.inventory_batches'::regclass,
    'logistics.customs_costs'::regclass,
    'logistics.freight_costs'::regclass,
    'logistics.landed_cost_allocations'::regclass,
    'procurement.document_entity_links'::regclass,
    'finance.product_cost_scenarios'::regclass
  ] LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', target);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', target);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %s TO amazon_ai_app USING (tenant_id = iam.current_tenant_id()) WITH CHECK (tenant_id = iam.current_tenant_id())', target
    );
  END LOOP;
END
$rls$;

GRANT USAGE ON SCHEMA selection, sourcing, logistics TO amazon_ai_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA selection, sourcing, logistics TO amazon_ai_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA market, procurement, finance TO amazon_ai_app;
GRANT EXECUTE ON FUNCTION selection.require_rejection_reason() TO amazon_ai_app;
GRANT EXECUTE ON FUNCTION sourcing.enforce_payment_allocation_balance() TO amazon_ai_app;

COMMIT;
