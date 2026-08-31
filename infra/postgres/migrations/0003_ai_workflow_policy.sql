BEGIN;

CREATE SCHEMA IF NOT EXISTS ai;
CREATE SCHEMA IF NOT EXISTS insights;
CREATE SCHEMA IF NOT EXISTS workflow;
CREATE SCHEMA IF NOT EXISTS memory;
CREATE SCHEMA IF NOT EXISTS policy_news;

CREATE TABLE insights.metric_definitions (
  metric_definition_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  name text NOT NULL,
  formula_sql text NOT NULL,
  grain text NOT NULL,
  date_basis text NOT NULL,
  attribution_window text NOT NULL,
  unit text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (metric_key, version)
);

CREATE TABLE insights.metric_observations (
  metric_observation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  metric_definition_id uuid NOT NULL REFERENCES insights.metric_definitions(metric_definition_id),
  scope_type text NOT NULL,
  scope_id text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  value_numeric numeric(24,8),
  value_date date,
  unit text NOT NULL,
  currency text NOT NULL,
  maturity text NOT NULL CHECK (maturity IN ('PROVISIONAL', 'MATURED', 'INCOMPLETE')),
  calculation_run_ref text NOT NULL,
  input_lineage jsonb NOT NULL,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, metric_observation_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (period_end >= period_start),
  CHECK (num_nonnulls(value_numeric, value_date) = 1)
);

CREATE TABLE ai.prompt_versions (
  prompt_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  prompt_role text NOT NULL,
  semantic_version text NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  schema_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT', 'PUBLISHED', 'RETIRED')),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, prompt_version_id),
  UNIQUE (tenant_id, prompt_role, semantic_version),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE TABLE ai.ai_conversations (
  conversation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  title text NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  scope_context_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, conversation_id),
  FOREIGN KEY (tenant_id, created_by)
    REFERENCES iam.user_accounts(tenant_id, user_id)
);

CREATE TABLE ai.ai_messages (
  message_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  conversation_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('USER', 'ASSISTANT', 'SYSTEM')),
  content_text text,
  content_object_uri text,
  context_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance_id uuid,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, message_id),
  FOREIGN KEY (tenant_id, conversation_id)
    REFERENCES ai.ai_conversations(tenant_id, conversation_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (num_nonnulls(content_text, content_object_uri) = 1)
);

CREATE TABLE ai.ai_runs (
  ai_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  conversation_id uuid,
  trigger_message_id uuid,
  prompt_version_id uuid,
  trigger_type text NOT NULL CHECK (trigger_type IN ('USER', 'DAILY', 'HOURLY', 'EVENT')),
  intent text NOT NULL,
  supervisor_status text NOT NULL
    CHECK (supervisor_status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'BLOCKED')),
  model text NOT NULL,
  trace_id text NOT NULL,
  structured_output jsonb,
  output_schema_version text,
  failure_code text,
  provenance_id uuid,
  synthetic boolean NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE (tenant_id, ai_run_id),
  UNIQUE (tenant_id, trace_id),
  FOREIGN KEY (tenant_id, conversation_id)
    REFERENCES ai.ai_conversations(tenant_id, conversation_id),
  FOREIGN KEY (tenant_id, trigger_message_id)
    REFERENCES ai.ai_messages(tenant_id, message_id),
  FOREIGN KEY (tenant_id, prompt_version_id)
    REFERENCES ai.prompt_versions(tenant_id, prompt_version_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (finished_at IS NULL OR finished_at >= started_at)
);

CREATE TABLE ai.agent_runs (
  agent_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  ai_run_id uuid NOT NULL,
  parent_agent_run_id uuid,
  agent_type text NOT NULL,
  input_refs jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED')),
  timeout_ms integer NOT NULL CHECK (timeout_ms > 0),
  budget jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_schema_version text NOT NULL,
  synthetic boolean NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE (tenant_id, agent_run_id),
  FOREIGN KEY (tenant_id, ai_run_id)
    REFERENCES ai.ai_runs(tenant_id, ai_run_id),
  FOREIGN KEY (tenant_id, parent_agent_run_id)
    REFERENCES ai.agent_runs(tenant_id, agent_run_id),
  CHECK (finished_at IS NULL OR finished_at >= started_at)
);

CREATE TABLE ai.tool_calls (
  tool_call_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  agent_run_id uuid NOT NULL,
  sequence_number integer NOT NULL CHECK (sequence_number > 0),
  tool_name text NOT NULL,
  tool_version text NOT NULL,
  validated_args jsonb NOT NULL,
  permission_class text NOT NULL
    CHECK (permission_class IN ('READ_ONLY', 'LOCAL_COMPUTE', 'CREATE_DRAFT')),
  permission_decision text NOT NULL CHECK (permission_decision IN ('ALLOWED', 'DENIED')),
  idempotency_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'DENIED')),
  synthetic boolean NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE (tenant_id, tool_call_id),
  UNIQUE (tenant_id, agent_run_id, sequence_number),
  UNIQUE (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, agent_run_id)
    REFERENCES ai.agent_runs(tenant_id, agent_run_id),
  CHECK (finished_at IS NULL OR finished_at >= started_at)
);

CREATE TABLE ai.tool_outputs (
  tool_output_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  tool_call_id uuid NOT NULL,
  structured_result jsonb,
  result_object_uri text,
  source_envelope jsonb NOT NULL,
  limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_record_reference text NOT NULL,
  checksum text NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, tool_output_id),
  UNIQUE (tenant_id, tool_call_id),
  FOREIGN KEY (tenant_id, tool_call_id)
    REFERENCES ai.tool_calls(tenant_id, tool_call_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (num_nonnulls(structured_result, result_object_uri) = 1)
);

CREATE TABLE ai.model_usage (
  model_usage_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  ai_run_id uuid NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  input_tokens integer NOT NULL CHECK (input_tokens >= 0),
  output_tokens integer NOT NULL CHECK (output_tokens >= 0),
  cached_tokens integer NOT NULL DEFAULT 0 CHECK (cached_tokens >= 0),
  cost_currency text NOT NULL,
  cost_amount numeric(18,8) NOT NULL CHECK (cost_amount >= 0),
  latency_ms integer NOT NULL CHECK (latency_ms >= 0),
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, model_usage_id),
  FOREIGN KEY (tenant_id, ai_run_id)
    REFERENCES ai.ai_runs(tenant_id, ai_run_id)
);

CREATE TABLE insights.ai_insights (
  ai_insight_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  ai_run_id uuid NOT NULL,
  insight_type text NOT NULL CHECK (insight_type IN ('ANOMALY', 'CAUSE', 'OPPORTUNITY', 'DATA_QUALITY', 'POLICY_IMPACT')),
  scope_type text NOT NULL,
  scope_id text NOT NULL,
  title text NOT NULL,
  conclusion text NOT NULL,
  causal_status text NOT NULL CHECK (causal_status IN ('OBSERVED_ASSOCIATION', 'EXPERIMENT_SUPPORTED', 'UNKNOWN')),
  counter_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  alternative_hypotheses jsonb NOT NULL DEFAULT '[]'::jsonb,
  limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence numeric(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  valid_until timestamptz,
  stale_at timestamptz,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, ai_insight_id),
  FOREIGN KEY (tenant_id, ai_run_id)
    REFERENCES ai.ai_runs(tenant_id, ai_run_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE insights.recommendations (
  recommendation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  ai_insight_id uuid NOT NULL,
  dedupe_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  action_type text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  proposed_change jsonb NOT NULL,
  expected_direction text NOT NULL CHECK (expected_direction IN ('UP', 'DOWN', 'STABLE', 'UNKNOWN')),
  expected_range jsonb,
  maximum_risk text NOT NULL,
  priority_components jsonb NOT NULL,
  priority_score numeric(12,6) NOT NULL,
  observation_window text NOT NULL,
  rollback_condition text NOT NULL,
  requires_approval boolean NOT NULL DEFAULT true,
  status text NOT NULL
    CHECK (status IN ('DRAFT', 'READY_FOR_REVIEW', 'APPROVED_NOT_EXECUTED', 'REJECTED', 'SNOOZED', 'EXPIRED', 'STALE')),
  expires_at timestamptz,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, recommendation_id),
  UNIQUE (tenant_id, dedupe_key, version),
  FOREIGN KEY (tenant_id, ai_insight_id)
    REFERENCES insights.ai_insights(tenant_id, ai_insight_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE insights.recommendation_evidence (
  recommendation_evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  recommendation_id uuid NOT NULL,
  evidence_type text NOT NULL
    CHECK (evidence_type IN ('METRIC', 'TOOL_OUTPUT', 'POLICY', 'DOCUMENT', 'USER_FACT')),
  metric_observation_id uuid,
  tool_output_id uuid,
  evidence_ref text,
  evidence_summary text NOT NULL,
  supports_or_challenges text NOT NULL CHECK (supports_or_challenges IN ('SUPPORTS', 'CHALLENGES', 'NEUTRAL')),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, recommendation_evidence_id),
  FOREIGN KEY (tenant_id, recommendation_id)
    REFERENCES insights.recommendations(tenant_id, recommendation_id),
  FOREIGN KEY (tenant_id, metric_observation_id)
    REFERENCES insights.metric_observations(tenant_id, metric_observation_id),
  FOREIGN KEY (tenant_id, tool_output_id)
    REFERENCES ai.tool_outputs(tenant_id, tool_output_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (num_nonnulls(metric_observation_id, tool_output_id, evidence_ref) = 1)
);

CREATE OR REPLACE FUNCTION insights.require_recommendation_evidence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('READY_FOR_REVIEW', 'APPROVED_NOT_EXECUTED') AND NOT EXISTS (
    SELECT 1 FROM insights.recommendation_evidence evidence
    WHERE evidence.tenant_id = NEW.tenant_id
      AND evidence.recommendation_id = NEW.recommendation_id
  ) THEN
    RAISE EXCEPTION 'Recommendation % cannot be reviewable without evidence', NEW.recommendation_id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;

CREATE CONSTRAINT TRIGGER recommendation_requires_evidence
AFTER INSERT OR UPDATE OF status ON insights.recommendations
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION insights.require_recommendation_evidence();

CREATE TABLE insights.anomaly_events (
  anomaly_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  rule_key text NOT NULL,
  rule_version text NOT NULL,
  scope_type text NOT NULL,
  scope_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RECOVERED')),
  severity text NOT NULL CHECK (severity IN ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  dedupe_key text NOT NULL,
  evidence_metric_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  recovered_at timestamptz,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, anomaly_event_id),
  UNIQUE (tenant_id, dedupe_key, started_at),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (last_seen_at >= started_at),
  CHECK ((status = 'RECOVERED' AND recovered_at IS NOT NULL) OR status <> 'RECOVERED')
);

CREATE TABLE ai.homepage_compositions (
  homepage_composition_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  ai_run_id uuid NOT NULL,
  marketplace text NOT NULL,
  business_date date NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  home_state text NOT NULL CHECK (home_state IN ('NORMAL', 'ORDER_AD_ANOMALY', 'INVENTORY_PROFIT_RISK', 'MARKET_POLICY_CHANGE', 'DATA_INCOMPLETE')),
  overall_judgment text NOT NULL,
  judgment_reason text NOT NULL,
  top_problem text,
  best_signal text,
  top_actions jsonb NOT NULL CHECK (jsonb_typeof(top_actions) = 'array'),
  schema_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT', 'PUBLISHED', 'STALE', 'SUPERSEDED')),
  data_updated_at timestamptz NOT NULL,
  confidence numeric(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, homepage_composition_id),
  UNIQUE (tenant_id, marketplace, business_date, version),
  FOREIGN KEY (tenant_id, ai_run_id)
    REFERENCES ai.ai_runs(tenant_id, ai_run_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE ai.homepage_blocks (
  homepage_block_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  homepage_composition_id uuid NOT NULL,
  component_type text NOT NULL CHECK (component_type IN (
    'executive_summary', 'priority_action', 'critical_alert', 'positive_signal',
    'metric_card', 'line_chart', 'comparison_chart', 'data_table', 'order_funnel',
    'ad_diagnosis', 'keyword_opportunity', 'competitor_change', 'inventory_risk',
    'profit_simulation', 'product_opportunity', 'policy_alert', 'news_impact',
    'experiment_result', 'approval_request', 'follow_up_question'
  )),
  component_version text NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  priority integer NOT NULL CHECK (priority BETWEEN 0 AND 100),
  display_reason text NOT NULL,
  payload jsonb NOT NULL,
  ai_insight_id uuid,
  recommendation_id uuid,
  data_updated_at timestamptz NOT NULL,
  confidence numeric(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  requires_approval boolean NOT NULL,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, homepage_block_id),
  UNIQUE (tenant_id, homepage_composition_id, position),
  FOREIGN KEY (tenant_id, homepage_composition_id)
    REFERENCES ai.homepage_compositions(tenant_id, homepage_composition_id),
  FOREIGN KEY (tenant_id, ai_insight_id)
    REFERENCES insights.ai_insights(tenant_id, ai_insight_id),
  FOREIGN KEY (tenant_id, recommendation_id)
    REFERENCES insights.recommendations(tenant_id, recommendation_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE workflow.approvals (
  approval_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  recommendation_id uuid NOT NULL,
  active_version integer NOT NULL CHECK (active_version > 0),
  action_type text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  immutable_action_payload jsonb NOT NULL,
  action_payload_hash text NOT NULL CHECK (action_payload_hash ~ '^[0-9a-f]{64}$'),
  before_state jsonb NOT NULL,
  after_state jsonb NOT NULL,
  rationale text NOT NULL,
  evidence_summary jsonb NOT NULL,
  expected_result text NOT NULL,
  maximum_risk text NOT NULL,
  observation_window text NOT NULL,
  rollback_condition text NOT NULL,
  input_version_hash text NOT NULL,
  status text NOT NULL
    CHECK (status IN ('DRAFT', 'READY_FOR_REVIEW', 'APPROVED_NOT_EXECUTED', 'REJECTED', 'SNOOZED', 'EXPIRED', 'STALE')),
  requested_by uuid,
  decided_by uuid,
  decided_at timestamptz,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, approval_id),
  FOREIGN KEY (tenant_id, recommendation_id)
    REFERENCES insights.recommendations(tenant_id, recommendation_id),
  FOREIGN KEY (tenant_id, requested_by)
    REFERENCES iam.user_accounts(tenant_id, user_id),
  FOREIGN KEY (tenant_id, decided_by)
    REFERENCES iam.user_accounts(tenant_id, user_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (
    (status IN ('APPROVED_NOT_EXECUTED', 'REJECTED') AND decided_by IS NOT NULL AND decided_at IS NOT NULL) OR
    (status NOT IN ('APPROVED_NOT_EXECUTED', 'REJECTED') AND decided_at IS NULL)
  )
);

CREATE UNIQUE INDEX approvals_one_active_per_recommendation_idx
  ON workflow.approvals (tenant_id, recommendation_id)
  WHERE status IN ('DRAFT', 'READY_FOR_REVIEW', 'APPROVED_NOT_EXECUTED', 'SNOOZED', 'STALE');

CREATE TABLE workflow.approval_events (
  approval_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  approval_id uuid NOT NULL,
  sequence_number integer NOT NULL CHECK (sequence_number > 0),
  from_status text,
  to_status text NOT NULL,
  actor_id uuid,
  reason text NOT NULL,
  state_snapshot jsonb NOT NULL,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, approval_event_id),
  UNIQUE (tenant_id, approval_id, sequence_number),
  FOREIGN KEY (tenant_id, approval_id)
    REFERENCES workflow.approvals(tenant_id, approval_id),
  FOREIGN KEY (tenant_id, actor_id)
    REFERENCES iam.user_accounts(tenant_id, user_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE workflow.action_executions (
  action_execution_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  approval_id uuid NOT NULL,
  execution_mode text NOT NULL CHECK (execution_mode = 'MANUAL_RECORDED'),
  status text NOT NULL CHECK (status IN ('MANUAL_RECORDED', 'VERIFIED', 'FAILED')),
  idempotency_key text NOT NULL,
  external_reference_hash text,
  executed_by uuid NOT NULL,
  executed_at timestamptz NOT NULL,
  result_snapshot jsonb NOT NULL,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, action_execution_id),
  UNIQUE (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, approval_id)
    REFERENCES workflow.approvals(tenant_id, approval_id),
  FOREIGN KEY (tenant_id, executed_by)
    REFERENCES iam.user_accounts(tenant_id, user_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE workflow.action_rollbacks (
  action_rollback_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  action_execution_id uuid NOT NULL,
  reason text NOT NULL,
  rollback_plan jsonb NOT NULL,
  rollback_result jsonb,
  status text NOT NULL CHECK (status IN ('PLANNED', 'MANUAL_RECORDED', 'VERIFIED', 'FAILED')),
  recorded_by uuid,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, action_rollback_id),
  FOREIGN KEY (tenant_id, action_execution_id)
    REFERENCES workflow.action_executions(tenant_id, action_execution_id),
  FOREIGN KEY (tenant_id, recorded_by)
    REFERENCES iam.user_accounts(tenant_id, user_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE workflow.experiments (
  experiment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  approval_id uuid,
  name text NOT NULL,
  hypothesis text NOT NULL,
  treatment_scope jsonb NOT NULL,
  baseline_definition jsonb NOT NULL,
  primary_metric_key text NOT NULL,
  guardrails jsonb NOT NULL,
  pre_window tstzrange NOT NULL,
  post_window tstzrange NOT NULL,
  success_rule jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT', 'READY', 'RUNNING', 'COMPLETED', 'CANCELLED')),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, experiment_id),
  FOREIGN KEY (tenant_id, approval_id)
    REFERENCES workflow.approvals(tenant_id, approval_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE workflow.experiment_reviews (
  experiment_review_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  experiment_id uuid NOT NULL,
  review_version integer NOT NULL CHECK (review_version > 0),
  result_metrics jsonb NOT NULL,
  data_maturity text NOT NULL CHECK (data_maturity IN ('PROVISIONAL', 'MATURED', 'INCOMPLETE')),
  interference_events jsonb NOT NULL DEFAULT '[]'::jsonb,
  conclusion text NOT NULL,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, experiment_review_id),
  UNIQUE (tenant_id, experiment_id, review_version),
  FOREIGN KEY (tenant_id, experiment_id)
    REFERENCES workflow.experiments(tenant_id, experiment_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE memory.business_memories (
  business_memory_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  owner_user_id uuid,
  ai_run_id uuid,
  memory_type text NOT NULL CHECK (memory_type IN ('PERMANENT_FACT', 'USER_PREFERENCE', 'TEMPORARY_HYPOTHESIS', 'AI_INFERENCE')),
  scope_type text NOT NULL,
  scope_id text,
  statement text NOT NULL,
  source_ref text NOT NULL,
  confirmed_by uuid,
  confidence numeric(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  valid_from timestamptz NOT NULL,
  valid_to timestamptz,
  last_verified_at timestamptz,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'SUPERSEDED', 'EXPIRED', 'RETRACTED')),
  supersedes_id uuid,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, business_memory_id),
  FOREIGN KEY (tenant_id, owner_user_id)
    REFERENCES iam.user_accounts(tenant_id, user_id),
  FOREIGN KEY (tenant_id, ai_run_id)
    REFERENCES ai.ai_runs(tenant_id, ai_run_id),
  FOREIGN KEY (tenant_id, confirmed_by)
    REFERENCES iam.user_accounts(tenant_id, user_id),
  FOREIGN KEY (tenant_id, supersedes_id)
    REFERENCES memory.business_memories(tenant_id, business_memory_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (valid_to IS NULL OR valid_to > valid_from),
  CHECK (memory_type NOT IN ('PERMANENT_FACT', 'USER_PREFERENCE') OR confirmed_by IS NOT NULL),
  CHECK (supersedes_id IS NULL OR status IN ('ACTIVE', 'SUPERSEDED'))
);

CREATE TABLE policy_news.policy_items (
  policy_item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  authority text NOT NULL,
  canonical_url text NOT NULL,
  policy_domain text NOT NULL,
  marketplace text NOT NULL,
  jurisdiction text NOT NULL,
  official_source boolean NOT NULL,
  title text NOT NULL,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, policy_item_id),
  UNIQUE (tenant_id, authority, marketplace, canonical_url),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE policy_news.news_items (
  news_item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  publisher text NOT NULL,
  canonical_url text NOT NULL,
  title text NOT NULL,
  topic text NOT NULL,
  published_at timestamptz NOT NULL,
  collected_at timestamptz NOT NULL,
  dedupe_hash text NOT NULL CHECK (dedupe_hash ~ '^[0-9a-f]{64}$'),
  official_source boolean NOT NULL,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, news_item_id),
  UNIQUE (tenant_id, dedupe_hash),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE policy_news.policy_changes (
  policy_change_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  policy_item_id uuid NOT NULL,
  corroborating_news_item_id uuid,
  source_content_hash text NOT NULL CHECK (source_content_hash ~ '^[0-9a-f]{64}$'),
  published_at timestamptz NOT NULL,
  effective_at timestamptz,
  change_summary text NOT NULL,
  source_snapshot_uri text NOT NULL,
  supersedes_policy_change_id uuid,
  verification_status text NOT NULL CHECK (verification_status IN ('UNVERIFIED', 'VERIFIED_OFFICIAL', 'CONFLICTING')),
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, policy_change_id),
  UNIQUE (tenant_id, policy_item_id, source_content_hash),
  FOREIGN KEY (tenant_id, policy_item_id)
    REFERENCES policy_news.policy_items(tenant_id, policy_item_id),
  FOREIGN KEY (tenant_id, corroborating_news_item_id)
    REFERENCES policy_news.news_items(tenant_id, news_item_id),
  FOREIGN KEY (tenant_id, supersedes_policy_change_id)
    REFERENCES policy_news.policy_changes(tenant_id, policy_change_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE policy_news.policy_impacts (
  policy_impact_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  policy_change_id uuid NOT NULL,
  ai_run_id uuid,
  impacted_account_id uuid,
  impacted_product_id uuid,
  scope_type text NOT NULL,
  impact_type text NOT NULL CHECK (impact_type IN ('RISK', 'OPPORTUNITY', 'NEUTRAL')),
  severity text NOT NULL CHECK (severity IN ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  deadline timestamptz,
  recommendation_text text NOT NULL,
  confidence numeric(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, policy_impact_id),
  FOREIGN KEY (tenant_id, policy_change_id)
    REFERENCES policy_news.policy_changes(tenant_id, policy_change_id),
  FOREIGN KEY (tenant_id, ai_run_id)
    REFERENCES ai.ai_runs(tenant_id, ai_run_id),
  FOREIGN KEY (tenant_id, impacted_account_id)
    REFERENCES connectors.marketplace_accounts(tenant_id, account_id),
  FOREIGN KEY (tenant_id, impacted_product_id)
    REFERENCES catalog.products(tenant_id, product_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE policy_news.data_freshness (
  data_freshness_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  connection_id uuid,
  source text NOT NULL,
  dataset text NOT NULL,
  scope_type text NOT NULL,
  scope_id text,
  expected_by timestamptz NOT NULL,
  last_success_at timestamptz,
  lag_seconds bigint CHECK (lag_seconds >= 0),
  status text NOT NULL CHECK (status IN ('FRESH', 'STALE', 'MISSING', 'DEGRADED', 'DISCONNECTED', 'SIMULATED')),
  checked_at timestamptz NOT NULL,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, data_freshness_id),
  UNIQUE (tenant_id, source, dataset, scope_type, scope_id, checked_at),
  FOREIGN KEY (tenant_id, connection_id)
    REFERENCES connectors.source_connections(tenant_id, connection_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id)
);

CREATE TABLE policy_news.notification_events (
  notification_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES iam.tenants(tenant_id),
  anomaly_event_id uuid,
  policy_impact_id uuid,
  recommendation_id uuid,
  channel text NOT NULL CHECK (channel IN ('IN_APP', 'EMAIL_DISABLED', 'WEBHOOK_DISABLED')),
  dedupe_key text NOT NULL,
  transition_type text NOT NULL CHECK (transition_type IN ('OPENED', 'ESCALATED', 'RECOVERED', 'REMINDER')),
  severity text NOT NULL CHECK (severity IN ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  delivery_status text NOT NULL CHECK (delivery_status IN ('QUEUED', 'DELIVERED', 'SUPPRESSED', 'FAILED')),
  delivered_at timestamptz,
  provenance_id uuid NOT NULL,
  synthetic boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, notification_event_id),
  UNIQUE (tenant_id, dedupe_key, transition_type),
  FOREIGN KEY (tenant_id, anomaly_event_id)
    REFERENCES insights.anomaly_events(tenant_id, anomaly_event_id),
  FOREIGN KEY (tenant_id, policy_impact_id)
    REFERENCES policy_news.policy_impacts(tenant_id, policy_impact_id),
  FOREIGN KEY (tenant_id, recommendation_id)
    REFERENCES insights.recommendations(tenant_id, recommendation_id),
  FOREIGN KEY (tenant_id, provenance_id)
    REFERENCES connectors.data_provenance(tenant_id, provenance_id),
  CHECK (num_nonnulls(anomaly_event_id, policy_impact_id, recommendation_id) = 1)
);

CREATE TRIGGER prompt_versions_append_only
BEFORE UPDATE OR DELETE ON ai.prompt_versions
FOR EACH ROW EXECUTE FUNCTION connectors.reject_mutation();

CREATE TRIGGER ai_messages_append_only
BEFORE UPDATE OR DELETE ON ai.ai_messages
FOR EACH ROW EXECUTE FUNCTION connectors.reject_mutation();

CREATE TRIGGER tool_outputs_append_only
BEFORE UPDATE OR DELETE ON ai.tool_outputs
FOR EACH ROW EXECUTE FUNCTION connectors.reject_mutation();

CREATE TRIGGER homepage_compositions_append_only
BEFORE UPDATE OR DELETE ON ai.homepage_compositions
FOR EACH ROW EXECUTE FUNCTION connectors.reject_mutation();

CREATE TRIGGER homepage_blocks_append_only
BEFORE UPDATE OR DELETE ON ai.homepage_blocks
FOR EACH ROW EXECUTE FUNCTION connectors.reject_mutation();

CREATE TRIGGER approval_events_append_only
BEFORE UPDATE OR DELETE ON workflow.approval_events
FOR EACH ROW EXECUTE FUNCTION connectors.reject_mutation();

CREATE TRIGGER business_memories_append_only
BEFORE UPDATE OR DELETE ON memory.business_memories
FOR EACH ROW EXECUTE FUNCTION connectors.reject_mutation();

CREATE TRIGGER policy_changes_append_only
BEFORE UPDATE OR DELETE ON policy_news.policy_changes
FOR EACH ROW EXECUTE FUNCTION connectors.reject_mutation();

CREATE INDEX metric_observation_scope_period_idx
  ON insights.metric_observations (tenant_id, metric_definition_id, scope_type, scope_id, period_start DESC);
CREATE INDEX ai_runs_trigger_started_idx
  ON ai.ai_runs (tenant_id, trigger_type, started_at DESC);
CREATE INDEX agent_runs_ai_run_started_idx
  ON ai.agent_runs (tenant_id, ai_run_id, started_at);
CREATE INDEX tool_calls_name_started_idx
  ON ai.tool_calls (tenant_id, tool_name, started_at DESC);
CREATE INDEX insights_scope_created_idx
  ON insights.ai_insights (tenant_id, scope_type, scope_id, created_at DESC);
CREATE INDEX recommendations_status_score_idx
  ON insights.recommendations (tenant_id, status, priority_score DESC);
CREATE INDEX anomaly_status_severity_idx
  ON insights.anomaly_events (tenant_id, status, severity, started_at DESC);
CREATE INDEX homepage_business_date_idx
  ON ai.homepage_compositions (tenant_id, marketplace, business_date DESC, status);
CREATE INDEX approvals_status_updated_idx
  ON workflow.approvals (tenant_id, status, updated_at DESC);
CREATE INDEX memories_scope_status_idx
  ON memory.business_memories (tenant_id, scope_type, scope_id, status, valid_to);
CREATE INDEX policy_changes_effective_idx
  ON policy_news.policy_changes (tenant_id, effective_at DESC);
CREATE INDEX policy_impacts_severity_deadline_idx
  ON policy_news.policy_impacts (tenant_id, severity, deadline);

DO $tenant_rls$
BEGIN
  ALTER TABLE iam.tenants ENABLE ROW LEVEL SECURITY;
  ALTER TABLE iam.tenants FORCE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON iam.tenants TO amazon_ai_app
    USING (tenant_id = iam.current_tenant_id())
    WITH CHECK (tenant_id = iam.current_tenant_id());
END
$tenant_rls$;

DO $rls$
DECLARE
  target regclass;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'insights.metric_observations'::regclass,
    'ai.prompt_versions'::regclass,
    'ai.ai_conversations'::regclass,
    'ai.ai_messages'::regclass,
    'ai.ai_runs'::regclass,
    'ai.agent_runs'::regclass,
    'ai.tool_calls'::regclass,
    'ai.tool_outputs'::regclass,
    'ai.model_usage'::regclass,
    'insights.ai_insights'::regclass,
    'insights.recommendations'::regclass,
    'insights.recommendation_evidence'::regclass,
    'insights.anomaly_events'::regclass,
    'ai.homepage_compositions'::regclass,
    'ai.homepage_blocks'::regclass,
    'workflow.approvals'::regclass,
    'workflow.approval_events'::regclass,
    'workflow.action_executions'::regclass,
    'workflow.action_rollbacks'::regclass,
    'workflow.experiments'::regclass,
    'workflow.experiment_reviews'::regclass,
    'memory.business_memories'::regclass,
    'policy_news.policy_items'::regclass,
    'policy_news.news_items'::regclass,
    'policy_news.policy_changes'::regclass,
    'policy_news.policy_impacts'::regclass,
    'policy_news.data_freshness'::regclass,
    'policy_news.notification_events'::regclass
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

GRANT SELECT ON iam.tenants TO amazon_ai_app;
GRANT SELECT ON connectors.source_registry TO amazon_ai_app;
GRANT SELECT ON insights.metric_definitions TO amazon_ai_app;
GRANT USAGE ON SCHEMA ai, insights, workflow, memory, policy_news TO amazon_ai_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ai, insights, workflow, memory, policy_news TO amazon_ai_app;
REVOKE INSERT, UPDATE, DELETE ON iam.tenants, insights.metric_definitions FROM amazon_ai_app;
GRANT EXECUTE ON FUNCTION insights.require_recommendation_evidence() TO amazon_ai_app;

COMMIT;
