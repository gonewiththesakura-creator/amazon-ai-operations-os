import type { HomeVisualizationsResponse, MetricSeriesVisualization } from "../../types/visualization";

const period = { start: "2026-08-02T07:00:00Z", end: "2026-09-01T07:00:00Z" };
const source = ["synthetic:test-sp-api"];
const evidence = [{ kind: "TOOL_OUTPUT" as const, reference_id: "tool:get_metric_series:test" }];

function metricSeries(metric: string, unit: string, base: number, step: number): MetricSeriesVisualization {
  return {
    metric,
    scope: "STORE",
    unit,
    lookback_days: 30,
    maturity: metric.startsWith("ad_") || ["acos", "cpc", "ctr"].includes(metric) ? "PROVISIONAL" : "MATURED",
    points: Array.from({ length: 30 }, (_, index) => ({
      period: `2026-08-${String(index + 2).padStart(2, "0")}`,
      value: Number((base + step * index + ((index % 5) - 2) * step * 0.35).toFixed(2)),
    })),
    evidence_refs: evidence,
    data_period: period,
    source,
    updated_at: "2026-08-31T12:00:00Z",
    confidence: 0.96,
    limitations: [],
    synthetic: true,
  };
}

export function homeVisualizations(): HomeVisualizationsResponse {
  return {
    business_date: "2026-08-31",
    marketplace: "ATVPDKIKX0DER",
    lookback_days: 30,
    metric_series: [
      metricSeries("orders", "COUNT", 35, 0.4),
      metricSeries("sales", "USD", 1320, 13),
      metricSeries("sessions", "COUNT", 510, 3.2),
      metricSeries("cvr", "PERCENT", 7.1, 0.035),
      metricSeries("ad_spend", "USD", 61, 0.32),
      metricSeries("ad_sales", "USD", 106, 1.1),
      metricSeries("acos", "PERCENT", 57, -0.18),
      metricSeries("cpc", "USD_PER_CLICK", 1.24, -0.004),
      metricSeries("ctr", "PERCENT", 0.43, 0.003),
    ],
    top_entities: [{
      metric: "sales",
      scope: "STORE",
      entity_type: "ASIN",
      unit: "USD",
      lookback_days: 30,
      entities: [
        { rank: 1, entity_id: "B0TEST001", label: "Cooling Memory Foam Pillow", value: 8420 },
        { rank: 2, entity_id: "B0TEST002", label: "Adjustable Sleep Pillow", value: 6250 },
        { rank: 3, entity_id: "B0TEST003", label: "Bamboo Pillowcase Set", value: 3910 },
      ],
      evidence_refs: evidence,
      data_period: period,
      source,
      updated_at: "2026-08-31T12:00:00Z",
      confidence: 0.97,
      limitations: [],
      synthetic: true,
    }],
    mix_breakdowns: [{
      metric: "sales",
      scope: "STORE",
      entity_type: "ASIN",
      unit: "USD",
      lookback_days: 30,
      total: 20780,
      categories: [
        { label: "Cooling Memory Foam Pillow", value: 8420, share_pct: 40.52, entity_id: "B0TEST001" },
        { label: "Adjustable Sleep Pillow", value: 6250, share_pct: 30.08, entity_id: "B0TEST002" },
        { label: "Bamboo Pillowcase Set", value: 3910, share_pct: 18.82, entity_id: "B0TEST003" },
        { label: "Other", value: 2200, share_pct: 10.58 },
      ],
      evidence_refs: evidence,
      data_period: period,
      source,
      updated_at: "2026-08-31T12:00:00Z",
      confidence: 0.97,
      limitations: [],
      synthetic: true,
    }],
    synthetic: true,
  };
}
