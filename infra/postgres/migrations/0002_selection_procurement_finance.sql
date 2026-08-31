BEGIN;

CREATE SCHEMA IF NOT EXISTS retail;
CREATE SCHEMA IF NOT EXISTS market;
CREATE SCHEMA IF NOT EXISTS procurement;
CREATE SCHEMA IF NOT EXISTS finance;

CREATE TABLE retail.fact_sales_traffic_daily (
  sales_traffic_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  account_id uuid NOT NULL,
  product_id uuid NOT NULL,
  business_date date NOT NULL,
  ordered_product_sales numeric(18,2) NOT NULL CHECK (ordered_product_sales >= 0),
  units_ordered integer NOT NULL CHECK (units_ordered >= 0),
  orders integer NOT NULL CHECK (orders >= 0),
  sessions integer NOT NULL CHECK (sessions >= 0),
  page_views integer NOT NULL CHECK (page_views >= 0),
  buy_box_percentage numeric(7,4) CHECK (buy_box_percentage BETWEEN 0 AND 1),
  currency text NOT NULL,
  maturity text NOT NULL CHECK (maturity IN ('PROVISIONAL', 'MATURED')),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sales_traffic_id),
  UNIQUE (tenant_id, product_id, business_date, provenance_id),
  FOREIGN KEY (tenant_id, account_id)
    REFERENCES connectors.marketplace_accounts(tenant_id, account_id),
  FOREIGN KEY (tenant_id, product_id)
    REFERENCES catalog.products(tenant_id, product_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (orders <= units_ordered),
  CHECK (sessions > 0 OR (orders = 0 AND units_ordered = 0))
);

CREATE TABLE market.market_opportunities (
  opportunity_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  marketplace text NOT NULL,
  opportunity_key text NOT NULL,
  category_path text NOT NULL,
  customer_job text NOT NULL,
  opportunity_hypothesis text NOT NULL,
  status text NOT NULL
    CHECK (status IN ('DISCOVERED', 'WATCHING', 'QUALIFIED', 'DISMISSED', 'ARCHIVED')),
  demand_score numeric(7,4) CHECK (demand_score BETWEEN 0 AND 100),
  competition_score numeric(7,4) CHECK (competition_score BETWEEN 0 AND 100),
  margin_potential_score numeric(7,4) CHECK (margin_potential_score BETWEEN 0 AND 100),
  evidence_coverage numeric(5,4) NOT NULL CHECK (evidence_coverage BETWEEN 0 AND 1),
  confidence numeric(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, opportunity_id),
  UNIQUE (tenant_id, marketplace, opportunity_key),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE market.market_snapshots (
  market_snapshot_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  opportunity_id uuid NOT NULL,
  observed_at timestamptz NOT NULL,
  marketplace text NOT NULL,
  active_listing_count integer CHECK (active_listing_count >= 0),
  median_price numeric(18,2) CHECK (median_price >= 0),
  median_rating numeric(4,3) CHECK (median_rating BETWEEN 0 AND 5),
  median_review_count integer CHECK (median_review_count >= 0),
  estimated_monthly_units numeric(18,2) CHECK (estimated_monthly_units >= 0),
  estimated_monthly_revenue numeric(18,2) CHECK (estimated_monthly_revenue >= 0),
  currency text NOT NULL,
  methodology_version text NOT NULL,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, market_snapshot_id),
  UNIQUE (tenant_id, opportunity_id, observed_at, methodology_version),
  FOREIGN KEY (tenant_id, opportunity_id)
    REFERENCES market.market_opportunities(tenant_id, opportunity_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE market.keyword_signals (
  keyword_signal_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  opportunity_id uuid NOT NULL,
  marketplace text NOT NULL,
  keyword_text text NOT NULL,
  normalized_keyword text NOT NULL,
  language text NOT NULL DEFAULT 'en-US',
  period_start date NOT NULL,
  period_end date NOT NULL,
  estimated_search_volume integer CHECK (estimated_search_volume >= 0),
  trend_index numeric(12,4) CHECK (trend_index >= 0),
  suggested_bid_low numeric(12,2) CHECK (suggested_bid_low >= 0),
  suggested_bid_high numeric(12,2) CHECK (suggested_bid_high >= suggested_bid_low),
  currency text NOT NULL,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, keyword_signal_id),
  FOREIGN KEY (tenant_id, opportunity_id)
    REFERENCES market.market_opportunities(tenant_id, opportunity_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (period_end >= period_start)
);

CREATE TABLE market.customer_pain_points (
  pain_point_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  opportunity_id uuid NOT NULL,
  pain_code text NOT NULL,
  pain_label text NOT NULL,
  feedback_type text NOT NULL CHECK (feedback_type IN ('REVIEW', 'RETURN', 'Q_AND_A', 'SOCIAL')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  mention_count integer NOT NULL CHECK (mention_count >= 0),
  sentiment numeric(5,4) CHECK (sentiment BETWEEN -1 AND 1),
  evidence_excerpt text,
  evidence_reference text NOT NULL,
  model_version text,
  confidence numeric(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, pain_point_id),
  FOREIGN KEY (tenant_id, opportunity_id)
    REFERENCES market.market_opportunities(tenant_id, opportunity_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (period_end >= period_start)
);

CREATE TABLE market.creative_signals (
  creative_signal_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  opportunity_id uuid NOT NULL,
  platform text NOT NULL CHECK (platform IN ('TIKTOK', 'YOUTUBE', 'AMAZON', 'OTHER_PUBLIC')),
  public_url text,
  observed_at timestamptz NOT NULL,
  creative_angle text NOT NULL,
  hook_pattern text,
  engagement_metric_name text,
  engagement_metric_value numeric(20,4),
  license_use text NOT NULL,
  demand_signal_only boolean NOT NULL DEFAULT true,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, creative_signal_id),
  FOREIGN KEY (tenant_id, opportunity_id)
    REFERENCES market.market_opportunities(tenant_id, opportunity_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (demand_signal_only)
);

CREATE TABLE market.competitor_products (
  competitor_product_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  marketplace text NOT NULL,
  external_product_ref text NOT NULL,
  title text NOT NULL,
  brand text,
  category text,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, competitor_product_id),
  UNIQUE (tenant_id, marketplace, external_product_ref),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE market.product_candidates (
  candidate_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  opportunity_id uuid NOT NULL,
  candidate_key text NOT NULL,
  working_title text NOT NULL,
  value_proposition text NOT NULL,
  target_customer text NOT NULL,
  target_price_low numeric(18,2) CHECK (target_price_low >= 0),
  target_price_high numeric(18,2) CHECK (target_price_high >= target_price_low),
  currency text NOT NULL,
  current_stage text NOT NULL
    CHECK (current_stage IN ('DISCOVERED', 'SCREENING', 'VALIDATING', 'SOURCING', 'APPROVED', 'REJECTED', 'ARCHIVED')),
  owner_user_id uuid,
  rejection_reason text,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, candidate_id),
  UNIQUE (tenant_id, candidate_key),
  FOREIGN KEY (tenant_id, opportunity_id)
    REFERENCES market.market_opportunities(tenant_id, opportunity_id),
  FOREIGN KEY (tenant_id, owner_user_id)
    REFERENCES iam.user_accounts(tenant_id, user_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK ((current_stage = 'REJECTED' AND rejection_reason IS NOT NULL) OR current_stage <> 'REJECTED')
);

CREATE TABLE market.candidate_stage_history (
  candidate_stage_history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  candidate_id uuid NOT NULL,
  from_stage text,
  to_stage text NOT NULL
    CHECK (to_stage IN ('DISCOVERED', 'SCREENING', 'VALIDATING', 'SOURCING', 'APPROVED', 'REJECTED', 'ARCHIVED')),
  reason text NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  UNIQUE (tenant_id, candidate_stage_history_id),
  FOREIGN KEY (tenant_id, candidate_id)
    REFERENCES market.product_candidates(tenant_id, candidate_id),
  FOREIGN KEY (tenant_id, changed_by)
    REFERENCES iam.user_accounts(tenant_id, user_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE market.candidate_evaluations (
  evaluation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  candidate_id uuid NOT NULL,
  evaluation_version integer NOT NULL CHECK (evaluation_version > 0),
  scoring_model_version text NOT NULL,
  demand_score numeric(7,4) CHECK (demand_score BETWEEN 0 AND 100),
  competition_score numeric(7,4) CHECK (competition_score BETWEEN 0 AND 100),
  differentiation_score numeric(7,4) CHECK (differentiation_score BETWEEN 0 AND 100),
  margin_score numeric(7,4) CHECK (margin_score BETWEEN 0 AND 100),
  supply_risk_score numeric(7,4) CHECK (supply_risk_score BETWEEN 0 AND 100),
  compliance_risk_score numeric(7,4) CHECK (compliance_risk_score BETWEEN 0 AND 100),
  overall_score numeric(7,4) CHECK (overall_score BETWEEN 0 AND 100),
  weights jsonb NOT NULL,
  missing_inputs jsonb NOT NULL DEFAULT '[]'::jsonb,
  limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence numeric(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  evaluated_at timestamptz NOT NULL,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, evaluation_id),
  UNIQUE (tenant_id, candidate_id, evaluation_version),
  FOREIGN KEY (tenant_id, candidate_id)
    REFERENCES market.product_candidates(tenant_id, candidate_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE market.candidate_evidence (
  candidate_evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  candidate_id uuid NOT NULL,
  evidence_type text NOT NULL
    CHECK (evidence_type IN ('MARKET_SNAPSHOT', 'KEYWORD', 'PAIN_POINT', 'CREATIVE', 'COMPETITOR', 'DOCUMENT', 'USER_NOTE')),
  evidence_ref text NOT NULL,
  supports_or_challenges text NOT NULL CHECK (supports_or_challenges IN ('SUPPORTS', 'CHALLENGES', 'NEUTRAL')),
  summary text NOT NULL,
  confidence numeric(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, candidate_evidence_id),
  UNIQUE (tenant_id, candidate_id, evidence_type, evidence_ref),
  FOREIGN KEY (tenant_id, candidate_id)
    REFERENCES market.product_candidates(tenant_id, candidate_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE market.candidate_competitors (
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  candidate_id uuid NOT NULL,
  competitor_product_id uuid NOT NULL,
  relationship text NOT NULL CHECK (relationship IN ('DIRECT', 'INDIRECT', 'SUBSTITUTE', 'REFERENCE')),
  rationale text NOT NULL,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, candidate_id, competitor_product_id),
  FOREIGN KEY (tenant_id, candidate_id)
    REFERENCES market.product_candidates(tenant_id, candidate_id),
  FOREIGN KEY (tenant_id, competitor_product_id)
    REFERENCES market.competitor_products(tenant_id, competitor_product_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE procurement.documents (
  document_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  document_type text NOT NULL
    CHECK (document_type IN ('CONTRACT', 'PURCHASE_ORDER', 'QUOTATION', 'INVOICE', 'PAYMENT_PROOF', 'LOGISTICS', 'CUSTOMS', 'OTHER')),
  object_uri text NOT NULL,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  original_filename text NOT NULL,
  mime_type text NOT NULL,
  uploaded_by uuid,
  status text NOT NULL
    CHECK (status IN ('UPLOADED', 'SCANNING', 'READY', 'EXTRACTION_PENDING', 'EXTRACTED', 'REJECTED')),
  supersedes_document_id uuid,
  retention_class text NOT NULL,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, document_id),
  FOREIGN KEY (tenant_id, uploaded_by)
    REFERENCES iam.user_accounts(tenant_id, user_id),
  FOREIGN KEY (tenant_id, supersedes_document_id)
    REFERENCES procurement.documents(tenant_id, document_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE procurement.document_extracted_fields (
  field_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  document_id uuid NOT NULL,
  field_name text NOT NULL,
  raw_text text NOT NULL,
  normalized_value jsonb,
  data_type text NOT NULL CHECK (data_type IN ('TEXT', 'NUMBER', 'DATE', 'CURRENCY', 'IDENTIFIER', 'JSON')),
  page_number integer CHECK (page_number > 0),
  evidence_locator text NOT NULL,
  confidence numeric(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  confirmation_status text NOT NULL DEFAULT 'PENDING'
    CHECK (confirmation_status IN ('PENDING', 'CONFIRMED', 'REJECTED')),
  confirmed_value jsonb,
  confirmed_by uuid,
  confirmed_at timestamptz,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, field_id),
  UNIQUE (tenant_id, field_id, confirmation_status),
  FOREIGN KEY (tenant_id, document_id)
    REFERENCES procurement.documents(tenant_id, document_id),
  FOREIGN KEY (tenant_id, confirmed_by)
    REFERENCES iam.user_accounts(tenant_id, user_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (
    (confirmation_status = 'PENDING' AND confirmed_value IS NULL AND confirmed_by IS NULL AND confirmed_at IS NULL) OR
    (confirmation_status = 'CONFIRMED' AND confirmed_value IS NOT NULL AND confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL) OR
    (confirmation_status = 'REJECTED' AND confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL)
  )
);

CREATE TABLE procurement.suppliers (
  supplier_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  supplier_key text NOT NULL,
  legal_name text NOT NULL,
  country_code text NOT NULL,
  default_currency text NOT NULL,
  status text NOT NULL CHECK (status IN ('PROSPECT', 'QUALIFIED', 'ACTIVE', 'BLOCKED', 'INACTIVE')),
  payment_terms text,
  risk_notes text,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, supplier_id),
  UNIQUE (tenant_id, supplier_key),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE procurement.supplier_products (
  supplier_product_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  supplier_id uuid NOT NULL,
  candidate_id uuid,
  product_id uuid,
  supplier_sku text NOT NULL,
  description text NOT NULL,
  moq integer NOT NULL CHECK (moq > 0),
  lead_time_days integer NOT NULL CHECK (lead_time_days >= 0),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, supplier_product_id),
  UNIQUE (tenant_id, supplier_id, supplier_sku),
  FOREIGN KEY (tenant_id, supplier_id)
    REFERENCES procurement.suppliers(tenant_id, supplier_id),
  FOREIGN KEY (tenant_id, candidate_id)
    REFERENCES market.product_candidates(tenant_id, candidate_id),
  FOREIGN KEY (tenant_id, product_id)
    REFERENCES catalog.products(tenant_id, product_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (num_nonnulls(candidate_id, product_id) >= 1)
);

CREATE TABLE procurement.supplier_quotations (
  quotation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  supplier_id uuid NOT NULL,
  candidate_id uuid,
  quotation_number text NOT NULL,
  quoted_at date NOT NULL,
  valid_until date,
  incoterm text NOT NULL,
  currency text NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT', 'RECEIVED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'EXPIRED')),
  document_id uuid,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, quotation_id),
  UNIQUE (tenant_id, supplier_id, quotation_number),
  FOREIGN KEY (tenant_id, supplier_id)
    REFERENCES procurement.suppliers(tenant_id, supplier_id),
  FOREIGN KEY (tenant_id, candidate_id)
    REFERENCES market.product_candidates(tenant_id, candidate_id),
  FOREIGN KEY (tenant_id, document_id)
    REFERENCES procurement.documents(tenant_id, document_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (valid_until IS NULL OR valid_until >= quoted_at)
);

CREATE TABLE procurement.quotation_lines (
  quotation_line_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  quotation_id uuid NOT NULL,
  supplier_product_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(18,6) NOT NULL CHECK (unit_price >= 0),
  packaging_unit_cost numeric(18,6) NOT NULL DEFAULT 0 CHECK (packaging_unit_cost >= 0),
  tooling_cost numeric(18,2) NOT NULL DEFAULT 0 CHECK (tooling_cost >= 0),
  sample_cost numeric(18,2) NOT NULL DEFAULT 0 CHECK (sample_cost >= 0),
  currency text NOT NULL,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, quotation_line_id),
  FOREIGN KEY (tenant_id, quotation_id)
    REFERENCES procurement.supplier_quotations(tenant_id, quotation_id),
  FOREIGN KEY (tenant_id, supplier_product_id)
    REFERENCES procurement.supplier_products(tenant_id, supplier_product_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE procurement.purchase_orders (
  purchase_order_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  supplier_id uuid NOT NULL,
  po_number text NOT NULL,
  order_date date NOT NULL,
  expected_ready_date date,
  incoterm text NOT NULL,
  currency text NOT NULL,
  total_amount numeric(18,2) NOT NULL CHECK (total_amount >= 0),
  status text NOT NULL
    CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED_NOT_SENT', 'SENT', 'IN_PRODUCTION', 'READY', 'CANCELLED', 'CLOSED')),
  approved_by uuid,
  approved_at timestamptz,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, purchase_order_id),
  UNIQUE (tenant_id, po_number),
  FOREIGN KEY (tenant_id, supplier_id)
    REFERENCES procurement.suppliers(tenant_id, supplier_id),
  FOREIGN KEY (tenant_id, approved_by)
    REFERENCES iam.user_accounts(tenant_id, user_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (expected_ready_date IS NULL OR expected_ready_date >= order_date),
  CHECK ((approved_by IS NULL AND approved_at IS NULL) OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
);

CREATE TABLE procurement.purchase_order_lines (
  purchase_order_line_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  purchase_order_id uuid NOT NULL,
  supplier_product_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(18,6) NOT NULL CHECK (unit_price >= 0),
  currency text NOT NULL,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, purchase_order_line_id),
  FOREIGN KEY (tenant_id, purchase_order_id)
    REFERENCES procurement.purchase_orders(tenant_id, purchase_order_id),
  FOREIGN KEY (tenant_id, supplier_product_id)
    REFERENCES procurement.supplier_products(tenant_id, supplier_product_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE procurement.payments (
  payment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  supplier_id uuid NOT NULL,
  payment_reference_hash text NOT NULL,
  payment_type text NOT NULL CHECK (payment_type IN ('DEPOSIT', 'BALANCE', 'REFUND', 'FEE', 'OTHER')),
  payment_date date NOT NULL,
  amount numeric(18,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL,
  status text NOT NULL CHECK (status IN ('PLANNED', 'PENDING_APPROVAL', 'PAID', 'FAILED', 'REFUNDED')),
  document_id uuid,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, payment_id),
  UNIQUE (tenant_id, payment_reference_hash),
  FOREIGN KEY (tenant_id, supplier_id)
    REFERENCES procurement.suppliers(tenant_id, supplier_id),
  FOREIGN KEY (tenant_id, document_id)
    REFERENCES procurement.documents(tenant_id, document_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE procurement.payment_allocations (
  payment_allocation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  payment_id uuid NOT NULL,
  purchase_order_id uuid NOT NULL,
  allocated_amount numeric(18,2) NOT NULL CHECK (allocated_amount > 0),
  currency text NOT NULL,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, payment_allocation_id),
  UNIQUE (tenant_id, payment_id, purchase_order_id),
  FOREIGN KEY (tenant_id, payment_id)
    REFERENCES procurement.payments(tenant_id, payment_id),
  FOREIGN KEY (tenant_id, purchase_order_id)
    REFERENCES procurement.purchase_orders(tenant_id, purchase_order_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE procurement.logistics_shipments (
  logistics_shipment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  shipment_reference text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('SEA', 'AIR', 'RAIL', 'TRUCK', 'COURIER', 'MULTIMODAL')),
  origin_country text NOT NULL,
  destination_country text NOT NULL,
  carrier_name text,
  forwarder_name text,
  departed_at timestamptz,
  expected_arrival_at timestamptz,
  arrived_at timestamptz,
  status text NOT NULL
    CHECK (status IN ('PLANNED', 'BOOKED', 'IN_TRANSIT', 'CUSTOMS', 'DELIVERED', 'DELAYED', 'CANCELLED')),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, logistics_shipment_id),
  UNIQUE (tenant_id, shipment_reference),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (expected_arrival_at IS NULL OR departed_at IS NULL OR expected_arrival_at >= departed_at),
  CHECK (arrived_at IS NULL OR departed_at IS NULL OR arrived_at >= departed_at)
);

CREATE TABLE procurement.shipment_purchase_order_lines (
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  logistics_shipment_id uuid NOT NULL,
  purchase_order_line_id uuid NOT NULL,
  units_shipped integer NOT NULL CHECK (units_shipped > 0),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, logistics_shipment_id, purchase_order_line_id),
  FOREIGN KEY (tenant_id, logistics_shipment_id)
    REFERENCES procurement.logistics_shipments(tenant_id, logistics_shipment_id),
  FOREIGN KEY (tenant_id, purchase_order_line_id)
    REFERENCES procurement.purchase_order_lines(tenant_id, purchase_order_line_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE procurement.logistics_events (
  logistics_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  logistics_shipment_id uuid NOT NULL,
  event_type text NOT NULL,
  event_at timestamptz NOT NULL,
  location text,
  status text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, logistics_event_id),
  UNIQUE (tenant_id, logistics_shipment_id, event_type, event_at),
  FOREIGN KEY (tenant_id, logistics_shipment_id)
    REFERENCES procurement.logistics_shipments(tenant_id, logistics_shipment_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE procurement.logistics_costs (
  logistics_cost_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  logistics_shipment_id uuid NOT NULL,
  cost_type text NOT NULL
    CHECK (cost_type IN ('FREIGHT', 'INSURANCE', 'CUSTOMS_DUTY', 'BROKERAGE', 'PORT', 'DRAYAGE', 'WAREHOUSE', 'LAST_MILE', 'OTHER')),
  amount numeric(18,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL,
  allocation_basis text NOT NULL CHECK (allocation_basis IN ('UNALLOCATED', 'UNITS', 'WEIGHT', 'VOLUME', 'VALUE', 'MANUAL')),
  document_id uuid,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, logistics_cost_id),
  FOREIGN KEY (tenant_id, logistics_shipment_id)
    REFERENCES procurement.logistics_shipments(tenant_id, logistics_shipment_id),
  FOREIGN KEY (tenant_id, document_id)
    REFERENCES procurement.documents(tenant_id, document_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE finance.fx_rates (
  fx_rate_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  rate_date date NOT NULL,
  base_currency text NOT NULL,
  quote_currency text NOT NULL,
  rate numeric(20,10) NOT NULL CHECK (rate > 0),
  rate_type text NOT NULL,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, fx_rate_id),
  UNIQUE (tenant_id, rate_date, base_currency, quote_currency, rate_type, provenance_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (base_currency <> quote_currency)
);

CREATE TABLE finance.cost_scenarios (
  cost_scenario_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  candidate_id uuid,
  product_id uuid,
  scenario_key text NOT NULL,
  name text NOT NULL,
  scenario_type text NOT NULL CHECK (scenario_type IN ('BASE', 'UPSIDE', 'DOWNSIDE', 'SUPPLIER', 'PRICE', 'FREIGHT', 'CUSTOM')),
  sale_price numeric(18,2) NOT NULL CHECK (sale_price >= 0),
  currency text NOT NULL,
  assumptions jsonb NOT NULL,
  contribution_margin numeric(18,4),
  break_even_acos numeric(9,6),
  completeness text NOT NULL CHECK (completeness IN ('INCOMPLETE', 'ESTIMATED', 'COMPLETE')),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, cost_scenario_id),
  UNIQUE (tenant_id, scenario_key),
  FOREIGN KEY (tenant_id, candidate_id)
    REFERENCES market.product_candidates(tenant_id, candidate_id),
  FOREIGN KEY (tenant_id, product_id)
    REFERENCES catalog.products(tenant_id, product_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (num_nonnulls(candidate_id, product_id) = 1),
  CHECK (break_even_acos IS NULL OR break_even_acos BETWEEN 0 AND 1),
  CHECK (completeness = 'COMPLETE' OR break_even_acos IS NULL)
);

CREATE TABLE finance.cost_scenario_components (
  cost_scenario_component_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  cost_scenario_id uuid NOT NULL,
  component_type text NOT NULL,
  amount_per_unit numeric(18,6) NOT NULL CHECK (amount_per_unit >= 0),
  currency text NOT NULL,
  is_estimated boolean NOT NULL,
  source_reference text NOT NULL,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, cost_scenario_component_id),
  UNIQUE (tenant_id, cost_scenario_id, component_type),
  FOREIGN KEY (tenant_id, cost_scenario_id)
    REFERENCES finance.cost_scenarios(tenant_id, cost_scenario_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE finance.product_cost_versions (
  cost_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  product_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  effective_from date NOT NULL,
  effective_to date,
  status text NOT NULL CHECK (status IN ('DRAFT', 'COMPLETE', 'SUPERSEDED')),
  confirmation_basis text NOT NULL
    CHECK (confirmation_basis IN ('MANUAL', 'OCR_CONFIRMED', 'SYSTEM_DERIVED')),
  source_currency text NOT NULL,
  reporting_currency text NOT NULL,
  fx_rate_id uuid,
  unit_product_cost numeric(18,6) NOT NULL CHECK (unit_product_cost >= 0),
  unit_packaging_cost numeric(18,6) NOT NULL DEFAULT 0 CHECK (unit_packaging_cost >= 0),
  unit_freight_cost numeric(18,6) CHECK (unit_freight_cost >= 0),
  unit_duty_cost numeric(18,6) CHECK (unit_duty_cost >= 0),
  other_unit_cost numeric(18,6) NOT NULL DEFAULT 0 CHECK (other_unit_cost >= 0),
  completeness_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  confirmed_by uuid,
  confirmed_at timestamptz,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, cost_version_id),
  UNIQUE (tenant_id, product_id, version),
  FOREIGN KEY (tenant_id, product_id)
    REFERENCES catalog.products(tenant_id, product_id),
  FOREIGN KEY (tenant_id, fx_rate_id)
    REFERENCES finance.fx_rates(tenant_id, fx_rate_id),
  FOREIGN KEY (tenant_id, confirmed_by)
    REFERENCES iam.user_accounts(tenant_id, user_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CHECK ((status = 'DRAFT' AND confirmed_by IS NULL AND confirmed_at IS NULL) OR
         (status <> 'DRAFT' AND confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL)),
  CHECK (source_currency = reporting_currency OR fx_rate_id IS NOT NULL),
  CHECK (status <> 'COMPLETE' OR (unit_freight_cost IS NOT NULL AND unit_duty_cost IS NOT NULL))
);

CREATE TABLE finance.cost_version_source_fields (
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  cost_version_id uuid NOT NULL,
  field_id uuid NOT NULL,
  confirmation_status text NOT NULL DEFAULT 'CONFIRMED' CHECK (confirmation_status = 'CONFIRMED'),
  component_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, cost_version_id, field_id, component_type),
  FOREIGN KEY (tenant_id, cost_version_id)
    REFERENCES finance.product_cost_versions(tenant_id, cost_version_id),
  FOREIGN KEY (tenant_id, field_id, confirmation_status)
    REFERENCES procurement.document_extracted_fields(tenant_id, field_id, confirmation_status)
);

CREATE TRIGGER cost_version_source_fields_append_only
BEFORE UPDATE OR DELETE ON finance.cost_version_source_fields
FOR EACH ROW EXECUTE FUNCTION connectors.reject_mutation();

CREATE OR REPLACE FUNCTION finance.require_confirmed_ocr_sources()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'COMPLETE' AND NEW.confirmation_basis = 'OCR_CONFIRMED' AND NOT EXISTS (
    SELECT 1
    FROM finance.cost_version_source_fields source_field
    WHERE source_field.tenant_id = NEW.tenant_id
      AND source_field.cost_version_id = NEW.cost_version_id
      AND source_field.confirmation_status = 'CONFIRMED'
  ) THEN
    RAISE EXCEPTION 'OCR-confirmed cost version % must reference at least one confirmed extracted field', NEW.cost_version_id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;

CREATE CONSTRAINT TRIGGER product_cost_version_confirmed_ocr
AFTER INSERT OR UPDATE OF status, confirmation_basis
ON finance.product_cost_versions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION finance.require_confirmed_ocr_sources();

CREATE INDEX sales_daily_tenant_product_date_idx
  ON retail.fact_sales_traffic_daily (tenant_id, product_id, business_date DESC);
CREATE INDEX market_snapshot_opportunity_time_idx
  ON market.market_snapshots (tenant_id, opportunity_id, observed_at DESC);
CREATE INDEX keyword_signal_opportunity_period_idx
  ON market.keyword_signals (tenant_id, opportunity_id, period_end DESC);
CREATE INDEX pain_point_opportunity_period_idx
  ON market.customer_pain_points (tenant_id, opportunity_id, period_end DESC);
CREATE INDEX candidate_stage_idx
  ON market.product_candidates (tenant_id, current_stage, updated_at DESC);
CREATE INDEX quotation_candidate_date_idx
  ON procurement.supplier_quotations (tenant_id, candidate_id, quoted_at DESC);
CREATE INDEX purchase_order_status_idx
  ON procurement.purchase_orders (tenant_id, status, order_date DESC);
CREATE INDEX logistics_status_eta_idx
  ON procurement.logistics_shipments (tenant_id, status, expected_arrival_at);
CREATE INDEX cost_version_product_effective_idx
  ON finance.product_cost_versions (tenant_id, product_id, effective_from DESC);

DO $rls$
DECLARE
  target regclass;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'retail.fact_sales_traffic_daily'::regclass,
    'market.market_opportunities'::regclass,
    'market.market_snapshots'::regclass,
    'market.keyword_signals'::regclass,
    'market.customer_pain_points'::regclass,
    'market.creative_signals'::regclass,
    'market.competitor_products'::regclass,
    'market.product_candidates'::regclass,
    'market.candidate_stage_history'::regclass,
    'market.candidate_evaluations'::regclass,
    'market.candidate_evidence'::regclass,
    'market.candidate_competitors'::regclass,
    'procurement.documents'::regclass,
    'procurement.document_extracted_fields'::regclass,
    'procurement.suppliers'::regclass,
    'procurement.supplier_products'::regclass,
    'procurement.supplier_quotations'::regclass,
    'procurement.quotation_lines'::regclass,
    'procurement.purchase_orders'::regclass,
    'procurement.purchase_order_lines'::regclass,
    'procurement.payments'::regclass,
    'procurement.payment_allocations'::regclass,
    'procurement.logistics_shipments'::regclass,
    'procurement.shipment_purchase_order_lines'::regclass,
    'procurement.logistics_events'::regclass,
    'procurement.logistics_costs'::regclass,
    'finance.fx_rates'::regclass,
    'finance.cost_scenarios'::regclass,
    'finance.cost_scenario_components'::regclass,
    'finance.product_cost_versions'::regclass,
    'finance.cost_version_source_fields'::regclass
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

GRANT USAGE ON SCHEMA retail, market, procurement, finance TO amazon_ai_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA retail, market, procurement, finance TO amazon_ai_app;
GRANT EXECUTE ON FUNCTION finance.require_confirmed_ocr_sources() TO amazon_ai_app;

COMMIT;
