import { describe, expect, it } from "vitest";
import type { TimeSeriesPoint } from "../types/visualization";
import {
  buildBlockVisualizationSpecs,
  buildCompositionVisualizationSpecs,
  buildDomainVisualizationModel,
  buildHomeVisualizationSpecs,
  buildMetricSparklineSpec,
  buildVisualizationSpec,
  buildVisualizationSpecs,
} from "../view-models/visualizations";
import { homeBlock, homeComposition } from "./fixtures/home";
import { homeVisualizations } from "./fixtures/visualizations";

describe("Visualization view model", () => {
  it("uses the complete source series without generating or reordering points", () => {
    const points = timeSeriesPoints(30);
    const spec = buildVisualizationSpec(timeSeriesSource("LINE", points));

    expect(spec).toMatchObject({ type: "LINE", data_source: "tool:get_metric_series:orders" });
    expect(spec?.type === "LINE" && spec.series.points).toEqual(points);
  });

  it.each([7, 14] as const)("caps a %i-day sparkline to the matching source tail", (window) => {
    const points = timeSeriesPoints(20);
    const spec = buildVisualizationSpec({ ...timeSeriesSource("SPARKLINE", points), window });

    expect(spec?.type).toBe("SPARKLINE");
    expect(spec?.type === "SPARKLINE" && spec.series.points).toEqual(points.slice(-window));
    expect(spec?.type === "SPARKLINE" && spec.series.points).toHaveLength(window);
  });

  it("defaults sparklines to seven points and rejects unsupported windows", () => {
    const points = timeSeriesPoints(20);
    const defaultSpec = buildVisualizationSpec(timeSeriesSource("SPARKLINE", points));
    const invalidSpec = buildVisualizationSpec({ ...timeSeriesSource("SPARKLINE", points), window: 10 });

    expect(defaultSpec?.type === "SPARKLINE" && defaultSpec.series.points).toEqual(points.slice(-7));
    expect(invalidSpec).toBeNull();
  });

  it("accepts only registered chart types and hides incomplete or corrupt data", () => {
    const valid = timeSeriesSource("LINE", timeSeriesPoints(2));
    expect(buildVisualizationSpec({ ...valid, type: "RADAR" })).toBeNull();
    expect(buildVisualizationSpec({ ...valid, data_source: "" })).toBeNull();
    expect(buildVisualizationSpec({ ...valid, series: { ...valid.series, points: [] } })).toBeNull();
    expect(buildVisualizationSpec({
      ...valid,
      series: { ...valid.series, points: [{ period: "2026-08-31", value: Number.NaN }] },
    })).toBeNull();
  });

  it("renders donuts only for meaningful part-to-whole metrics", () => {
    const values = [
      { label: "ASIN-A", value: 42 },
      { label: "ASIN-B", value: 28 },
    ];
    const base = categorySource("DONUT", "sales_by_asin", values);

    expect(buildVisualizationSpec(base)?.type).toBe("DONUT");
    expect(buildVisualizationSpec({ ...base, series: { ...base.series, metric: "acos" } })).toBeNull();
    expect(buildVisualizationSpec({ ...base, series: { ...base.series, values: [{ label: "ASIN-A", value: 42 }] } })).toBeNull();
    expect(buildVisualizationSpec({ ...base, series: { ...base.series, values: values.map((item) => ({ ...item, value: 0 })) } })).toBeNull();
  });

  it("keeps donuts at five slices while preserving the source total", () => {
    const sourceValues = [8, 30, 5, 20, 12, 10].map((value, index) => ({ label: `ASIN-${index + 1}`, value }));
    const spec = buildVisualizationSpec(categorySource("DONUT", "sales_by_asin", sourceValues));

    expect(spec?.type).toBe("DONUT");
    if (!spec || spec.type !== "DONUT") throw new Error("expected donut spec");
    expect(spec.series.values).toHaveLength(5);
    expect(spec.series.values.at(-1)).toEqual({ label: "其他", value: 13 });
    expect(spec.series.values.reduce((sum, item) => sum + item.value, 0)).toBe(85);
    expect(spec.total).toBe(85);
  });

  it("preserves signed category values for bars but rejects invalid donut slices", () => {
    const signed = [{ label: "上升", value: 8 }, { label: "下降", value: -4 }];
    expect(buildVisualizationSpec(categorySource("BAR", "ranking_movers", signed))?.type).toBe("BAR");
    expect(buildVisualizationSpec(categorySource("DONUT", "orders_by_asin", signed))).toBeNull();
  });

  it("validates progress bounds", () => {
    const base = {
      type: "PROGRESS",
      title: "库存覆盖",
      data_source: "tool:get_top_entities:inventory",
      period: "2026-08-31",
      synthetic: true,
      metric: "inventory_days",
      unit: "days",
      value: 18,
      max: 60,
    };
    expect(buildVisualizationSpec(base)?.type).toBe("PROGRESS");
    expect(buildVisualizationSpec({ ...base, value: 61 })).toBeNull();
    expect(buildVisualizationSpec({ ...base, max: 0 })).toBeNull();
  });

  it("reads only explicit block visualization sources and retains block provenance", () => {
    const source = timeSeriesSource("LINE", timeSeriesPoints(3));
    const chartBlock = homeBlock({
      block_id: "block-with-series",
      payload: { visualizations: [source, { ...source, type: "RADAR" }] },
    });
    const scalarBlock = homeBlock({
      block_id: "block-with-scalars",
      payload: { orders: 42, sales: 1846, acos: 31.2 },
    });

    expect(buildBlockVisualizationSpecs(chartBlock)).toHaveLength(1);
    expect(buildBlockVisualizationSpecs(chartBlock)[0].source_block_id).toBe("block-with-series");
    expect(buildBlockVisualizationSpecs(scalarBlock)).toEqual([]);
    expect(buildCompositionVisualizationSpecs(homeComposition({ blocks: [scalarBlock] }))).toEqual([]);
    expect(buildCompositionVisualizationSpecs(homeComposition({ blocks: [scalarBlock, chartBlock] }))).toHaveLength(1);
  });

  it("filters invalid entries without manufacturing fallback specs", () => {
    const valid = categorySource("BAR", "campaign_spend", [{ label: "Campaign A", value: 12 }]);
    expect(buildVisualizationSpecs([valid, null, {}, { ...valid, series: undefined }])).toEqual([
      expect.objectContaining({ type: "BAR", title: "分类分布" }),
    ]);
  });

  it("maps the deterministic API envelope without changing source points", () => {
    const response = homeVisualizations();
    const specs = buildHomeVisualizationSpecs(response);
    const orders = specs.find((spec) => spec.type === "LINE" && spec.series.metric === "orders");
    expect(orders?.type === "LINE" && orders.series.points).toEqual(response.metric_series[0].points);
    expect(specs.some((spec) => spec.type === "DONUT" && spec.series.values.length <= 5)).toBe(true);
    expect(specs.every((spec) => spec.synthetic)).toBe(true);
  });

  it("chooses one primary and at most one secondary visualization per domain", () => {
    const specs = buildHomeVisualizationSpecs(homeVisualizations());
    const sales = buildDomainVisualizationModel("SALES_CONVERSION", specs);
    const ads = buildDomainVisualizationModel("ADVERTISING", specs);
    expect(sales?.primary.type).toBe("LINE");
    expect(sales?.secondary?.type).toBe("DONUT");
    expect(ads?.primary.type).toBe("LINE");
    expect(ads?.secondary).toBeNull();
  });

  it("derives a seven-day sparkline only from an existing source series", () => {
    const specs = buildHomeVisualizationSpecs(homeVisualizations());
    const sparkline = buildMetricSparklineSpec("订单", specs);
    expect(sparkline?.series.points).toEqual(homeVisualizations().metric_series[0].points.slice(-7));
    expect(buildMetricSparklineSpec("贡献利润", specs)).toBeNull();
  });
});

function timeSeriesSource(type: "SPARKLINE" | "LINE", points: TimeSeriesPoint[]) {
  return {
    type,
    title: "订单趋势",
    subtitle: "30 天",
    data_source: "tool:get_metric_series:orders",
    period: "2026-08-02/2026-08-31",
    synthetic: true,
    series: { metric: "orders", unit: "count", points },
  };
}

function categorySource(type: "BAR" | "DONUT", metric: string, values: Array<{ label: string; value: number }>) {
  return {
    type,
    title: "分类分布",
    data_source: "tool:get_mix_breakdown:test",
    period: "2026-08-31",
    synthetic: true,
    series: { metric, unit: "USD", values },
  };
}

function timeSeriesPoints(count: number): TimeSeriesPoint[] {
  return Array.from({ length: count }, (_, index) => ({
    period: `2026-08-${String(index + 1).padStart(2, "0")}`,
    value: index * 3,
  }));
}
