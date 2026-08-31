BEGIN;

CREATE SCHEMA IF NOT EXISTS ads;

CREATE TABLE ads.fact_sp_advertising_daily (
  sp_advertising_daily_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  account_id uuid NOT NULL,
  business_date date NOT NULL,
  impressions integer NOT NULL CHECK (impressions >= 0),
  clicks integer NOT NULL CHECK (clicks >= 0),
  spend numeric(18,2) NOT NULL CHECK (spend >= 0),
  attributed_orders integer NOT NULL CHECK (attributed_orders >= 0),
  attributed_sales numeric(18,2) NOT NULL CHECK (attributed_sales >= 0),
  currency text NOT NULL,
  maturity text NOT NULL CHECK (maturity IN ('PROVISIONAL', 'MATURED')),
  attribution_window text NOT NULL CHECK (attribution_window = '14_DAY_CLICK'),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sp_advertising_daily_id),
  UNIQUE (tenant_id, account_id, business_date, provenance_id),
  FOREIGN KEY (tenant_id, account_id)
    REFERENCES connectors.marketplace_accounts(tenant_id, account_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (clicks <= impressions),
  CHECK (attributed_orders = 0 OR clicks > 0),
  CHECK ((synthetic AND currency = 'USD') OR NOT synthetic)
);

CREATE INDEX sp_ads_tenant_account_date_idx
  ON ads.fact_sp_advertising_daily (tenant_id, account_id, business_date DESC);

ALTER TABLE ads.fact_sp_advertising_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads.fact_sp_advertising_daily FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ads.fact_sp_advertising_daily
  TO amazon_ai_app
  USING (tenant_id = iam.current_tenant_id())
  WITH CHECK (tenant_id = iam.current_tenant_id());

GRANT USAGE ON SCHEMA ads TO amazon_ai_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ads.fact_sp_advertising_daily TO amazon_ai_app;

COMMIT;
