export type HomeState =
  | "NORMAL"
  | "ORDER_AD_ANOMALY"
  | "INVENTORY_PROFIT_RISK"
  | "MARKET_POLICY_CHANGE"
  | "DATA_INCOMPLETE";

export type ObjectiveProfile =
  | "LAUNCH_GROWTH"
  | "SCALE_GROWTH"
  | "HARVEST_PROFIT"
  | "RECOVERY_RANK"
  | "MIXED_STORE";

export type ComponentType =
  | "executive_summary"
  | "priority_action"
  | "critical_alert"
  | "positive_signal"
  | "metric_card"
  | "line_chart"
  | "comparison_chart"
  | "data_table"
  | "order_funnel"
  | "ad_diagnosis"
  | "keyword_opportunity"
  | "competitor_change"
  | "inventory_risk"
  | "profit_simulation"
  | "product_opportunity"
  | "policy_alert"
  | "news_impact"
  | "experiment_result"
  | "approval_request"
  | "follow_up_question";

export type EvidenceKind =
  | "METRIC"
  | "TOOL_OUTPUT"
  | "RAW_RECORD"
  | "POLICY"
  | "DOCUMENT"
  | "ANOMALY";

export type EvidenceReference = {
  kind: EvidenceKind;
  reference_id: string;
};

export type DataPeriod = {
  start: string;
  end: string;
};

export type SourceReference = {
  name: string;
  source_kind: "SYNTHETIC" | "LIVE_API" | "USER_UPLOAD" | "PUBLIC_WEB";
  semantic_source_kind:
    | "FIRST_PARTY"
    | "THIRD_PARTY_ESTIMATE"
    | "AI_INFERENCE"
    | "USER_PROVIDED";
};

export type ProvenanceEnvelope = {
  source: SourceReference[];
  collected_at: string;
  data_period: DataPeriod;
  marketplace: string;
  timezone: string;
  currency: string;
  grain: string;
  date_basis: "ORDER_DATE" | "TRAFFIC_DATE" | "SNAPSHOT_TIME" | "DOCUMENT_DATE" | "NOT_APPLICABLE";
  attribution_window: string;
  is_estimated: boolean;
  synthetic: boolean;
  confidence: number;
  limitations: string[];
  raw_record_reference: string[];
  schema_version: string;
};

export type ActionSummary = {
  action_id: string;
  priority: number;
  title: string;
  action_type: string;
  reason: string;
  requires_approval: boolean;
  evidence_refs: EvidenceReference[];
};

export type DataStatus = {
  status: string;
  synthetic: boolean;
  updated_at: string;
  source_names: string[];
  ai_mode?: "ENABLED" | "DETERMINISTIC_FALLBACK";
};

export type HomeBlock = {
  block_id: string;
  component_type: ComponentType;
  component_version: string;
  priority: number;
  display_reason: string;
  title: string;
  payload: Record<string, unknown>;
  evidence_refs: EvidenceReference[];
  data_period: DataPeriod;
  updated_at: string;
  confidence: number;
  limitations: string[];
  requires_approval: boolean;
  synthetic: boolean;
  provenance: ProvenanceEnvelope[];
};

export type HomeComposition = {
  schema_version: string;
  composition_id: string;
  tenant_id: string;
  business_date: string;
  generated_at: string;
  marketplace: string;
  home_state: HomeState;
  objective_profile: ObjectiveProfile;
  overall_judgment: string;
  overall_confidence: number;
  requires_approval: boolean;
  judgment_reasons: Array<{ claim: string; evidence_refs: EvidenceReference[] }>;
  top_issue: { summary: string; severity: string | null; evidence_refs: EvidenceReference[] };
  best_signal: { summary: string; severity: string | null; evidence_refs: EvidenceReference[] };
  top_actions: ActionSummary[];
  data_status: DataStatus;
  blocks: HomeBlock[];
  synthetic: boolean;
};

