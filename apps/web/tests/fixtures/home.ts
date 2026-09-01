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

function runtimeBlocks(): HomeBlock[] {
  const orderEvidence = [{ kind: "ANOMALY" as const, reference_id: "tool:detect_anomalies:test" }];
  const funnelEvidence = [{ kind: "TOOL_OUTPUT" as const, reference_id: "tool:order_funnel:test" }];
  const adEvidence = [{ kind: "TOOL_OUTPUT" as const, reference_id: "tool:ad_efficiency:test" }];
  return [
    block({ evidence_refs: orderEvidence }),
    block({
      block_id: "10000000-0000-4000-8000-000000000002",
      component_type: "order_funnel",
      priority: 2,
      title: "订单漏斗",
      display_reason: "区分流量与转化变化。",
      payload: { sessions: 560, orders: 45, units: 47, unit_session_percentage: 8.39 },
      evidence_refs: funnelEvidence,
    }),
    block({
      block_id: "10000000-0000-4000-8000-000000000003",
      component_type: "ad_diagnosis",
      priority: 3,
      title: "Sponsored Products 归因信号",
      display_reason: "广告归因尚未成熟。",
      payload: { spend: 72, ad_sales: 128, acos: 56.25, finding: "花费没有同步下降。", attribution_window: "14_DAY_CLICK" },
      confidence: 0.78,
      limitations: ["广告归因窗口尚未成熟。"],
      evidence_refs: adEvidence,
    }),
    block({
      block_id: "10000000-0000-4000-8000-000000000004",
      component_type: "priority_action",
      priority: 4,
      title: "先验证转化下降原因",
      display_reason: "CVR 降幅大于 Sessions 降幅。",
      payload: { summary: "先检查可售、价格与详情页，再审阅广告草案。" },
      requires_approval: true,
      confidence: 0.9,
      evidence_refs: [...orderEvidence, ...funnelEvidence, ...adEvidence],
    }),
    block({
      block_id: "10000000-0000-4000-8000-000000000005",
      component_type: "data_table",
      priority: 5,
      title: "确定性诊断输出",
      display_reason: "公开数据库数据引用。",
      payload: { summary: "28 个成熟基线日。", data_ref: "postgres:store-day:test" },
    }),
    block({
      block_id: "10000000-0000-4000-8000-000000000006",
      component_type: "follow_up_question",
      priority: 6,
      title: "继续追问",
      display_reason: "在相同上下文继续分析。",
      payload: { summary: "我现在应该先改广告吗？" },
      confidence: 0.9,
    }),
  ];
}

export function homeComposition(overrides: Partial<HomeComposition> = {}): HomeComposition {
  const evidence = [{ kind: "ANOMALY" as const, reference_id: "tool:detect_anomalies:test" }];
  const funnelEvidence = [{ kind: "TOOL_OUTPUT" as const, reference_id: "tool:order_funnel:test" }];
  const adEvidence = [{ kind: "TOOL_OUTPUT" as const, reference_id: "tool:ad_efficiency:test" }];
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
    top_actions: [
      {
        action_id: "30000000-0000-4000-8000-000000000001",
        priority: 1,
        title: "检查转化阻断",
        action_type: "CREATE_CONVERSION_REVIEW_DRAFT",
        reason: "只生成草案。",
        requires_approval: true,
        evidence_refs: funnelEvidence,
      },
      {
        action_id: "30000000-0000-4000-8000-000000000002",
        priority: 2,
        title: "复核 SP 搜索词与预算",
        action_type: "CREATE_AD_REVIEW_DRAFT",
        reason: "暂不执行修改。",
        requires_approval: true,
        evidence_refs: adEvidence,
      },
      {
        action_id: "30000000-0000-4000-8000-000000000003",
        priority: 3,
        title: "等待归因成熟后复查 ACOS",
        action_type: "CREATE_ATTRIBUTION_REVIEW_DRAFT",
        reason: "保持 14 日归因口径。",
        requires_approval: true,
        evidence_refs: adEvidence,
      },
    ],
    data_status: {
      status: "PROVISIONAL",
      synthetic: true,
      updated_at: "2026-08-31T12:00:00Z",
      source_names: ["synthetic:test-sp-api"],
      ai_mode: "DETERMINISTIC_FALLBACK",
    },
    blocks: runtimeBlocks(),
    synthetic: true,
    ...overrides,
  };
}

export { block as homeBlock };
