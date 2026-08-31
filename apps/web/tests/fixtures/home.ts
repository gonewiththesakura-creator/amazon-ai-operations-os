import type { HomeBlock, HomeComposition, ProvenanceEnvelope } from "../../types/home";

const period = {
  start: "2026-08-31T07:00:00Z",
  end: "2026-09-01T07:00:00Z",
};

const provenance: ProvenanceEnvelope = {
  source: [{
    name: "synthetic:test-sp-api",
    source_kind: "SYNTHETIC",
    semantic_source_kind: "FIRST_PARTY",
  }],
  collected_at: "2026-08-31T12:00:00Z",
  data_period: period,
  marketplace: "ATVPDKIKX0DER",
  timezone: "America/Los_Angeles",
  currency: "USD",
  grain: "STORE_DAY",
  date_basis: "ORDER_DATE",
  attribution_window: "NOT_APPLICABLE",
  is_estimated: false,
  synthetic: true,
  confidence: 1,
  limitations: [],
  raw_record_reference: ["synthetic:store-day:2026-08-31"],
  schema_version: "1.0",
};

function block(overrides: Partial<HomeBlock> = {}): HomeBlock {
  return {
    block_id: "10000000-0000-4000-8000-000000000001",
    component_type: "critical_alert",
    component_version: "1.0",
    priority: 1,
    display_reason: "订单下降超过确定性阈值。",
    title: "今日订单显著低于合格基线",
    payload: {
      severity: "CRITICAL",
      summary: "订单下降 55.00%。",
      observed_value: 45,
      baseline_value: 100,
      delta_pct: -55,
    },
    evidence_refs: [{ kind: "ANOMALY", reference_id: "tool:detect_anomalies:test" }],
    data_period: period,
    updated_at: "2026-08-31T12:00:00Z",
    confidence: 0.98,
    limitations: [],
    requires_approval: false,
    synthetic: true,
    provenance: [provenance],
    ...overrides,
  };
}

export function homeComposition(overrides: Partial<HomeComposition> = {}): HomeComposition {
  const evidence = [{ kind: "ANOMALY" as const, reference_id: "tool:detect_anomalies:test" }];
  return {
    schema_version: "1.0",
    composition_id: "20000000-0000-4000-8000-000000000001",
    tenant_id: "00000000-0000-0000-0000-000000000001",
    business_date: "2026-08-31",
    generated_at: "2026-08-31T12:00:00Z",
    marketplace: "ATVPDKIKX0DER",
    home_state: "ORDER_AD_ANOMALY",
    objective_profile: "RECOVERY_RANK",
    overall_judgment: "订单下降，流量下降只能解释一部分。",
    overall_confidence: 0.94,
    requires_approval: true,
    judgment_reasons: [{ claim: "订单较基线下降。", evidence_refs: evidence }],
    top_issue: { summary: "订单、Sessions 与 CVR 同时下降。", severity: "CRITICAL", evidence_refs: evidence },
    best_signal: { summary: "数据完整，可继续下钻。", severity: null, evidence_refs: evidence },
    top_actions: [{
      action_id: "30000000-0000-4000-8000-000000000001",
      priority: 1,
      title: "检查转化阻断",
      action_type: "CREATE_CONVERSION_REVIEW_DRAFT",
      reason: "只生成草案。",
      requires_approval: true,
      evidence_refs: evidence,
    }],
    data_status: {
      status: "PROVISIONAL",
      synthetic: true,
      updated_at: "2026-08-31T12:00:00Z",
      source_names: ["synthetic:test-sp-api"],
      ai_mode: "DETERMINISTIC_FALLBACK",
    },
    blocks: [block()],
    synthetic: true,
    ...overrides,
  };
}

export { block as homeBlock };
