import type { HomeBlock, HomeComposition } from "../types/home";
import type { OperatingDomainId } from "./operating-domains";
import {
  PART_TO_WHOLE_METRICS,
  VISUALIZATION_TYPES,
  type BarVisualizationSpec,
  type CategorySeries,
  type CategoryValue,
  type DonutVisualizationSpec,
  type LineVisualizationSpec,
  type PartToWholeMetric,
  type ProgressVisualizationSpec,
  type SparklineVisualizationSpec,
  type SparklineWindow,
  type TimeSeries,
  type HomeVisualizationsResponse,
  type VisualizationSpec,
  type VisualizationType,
} from "../types/visualization";

const visualizationTypes = new Set<string>(VISUALIZATION_TYPES);
const partToWholeMetrics = new Set<string>(PART_TO_WHOLE_METRICS);

/**
 * Converts an explicit deterministic visualization source into renderable data.
 * It deliberately does not infer historical points from scalar HomeBlock payloads.
 */
export function buildVisualizationSpec(source: unknown, sourceBlockId?: HomeBlock["block_id"]): VisualizationSpec | null {
  if (!isRecord(source) || !isVisualizationType(source.type) || !hasValidMetadata(source)) return null;

  const base = {
    title: source.title,
    ...(typeof source.subtitle === "string" && source.subtitle.trim() ? { subtitle: source.subtitle } : {}),
    data_source: source.data_source,
    period: source.period,
    synthetic: source.synthetic,
    ...(isEvidenceReferenceArray(source.evidence_refs) ? { evidence_refs: source.evidence_refs } : {}),
    ...(isNonEmptyString(source.updated_at) ? { updated_at: source.updated_at } : {}),
    ...(isFiniteNumber(source.confidence) && source.confidence >= 0 && source.confidence <= 1 ? { confidence: source.confidence } : {}),
    ...(isStringArray(source.limitations) ? { limitations: source.limitations } : {}),
    ...(sourceBlockId ? { source_block_id: sourceBlockId } : {}),
  };

  if (source.type === "SPARKLINE") {
    const series = readTimeSeries(source.series);
    const window = readSparklineWindow(source.window);
    if (!series || series.points.length < 2 || window === null) return null;
    return {
      ...base,
      type: "SPARKLINE",
      series: { ...series, points: series.points.slice(-window) },
      window,
    } satisfies SparklineVisualizationSpec;
  }

  if (source.type === "LINE") {
    const series = readTimeSeries(source.series);
    if (!series || series.points.length < 2) return null;
    const direction = source.y_axis_direction === undefined ? "NORMAL" : source.y_axis_direction;
    if (direction !== "NORMAL" && direction !== "INVERTED") return null;
    return {
      ...base,
      type: "LINE",
      series,
      y_axis_direction: direction,
    } satisfies LineVisualizationSpec;
  }

  if (source.type === "BAR") {
    const series = readCategorySeries(source.series);
    if (!series || series.values.length === 0) return null;
    return { ...base, type: "BAR", series } satisfies BarVisualizationSpec;
  }

  if (source.type === "DONUT") {
    const series = readCategorySeries(source.series, { nonNegative: true });
    if (!series || series.values.length < 2 || !isPartToWholeMetric(series.metric)) return null;
    const total = series.values.reduce((sum, item) => sum + item.value, 0);
    if (!(total > 0)) return null;
    return {
      ...base,
      type: "DONUT",
      series: { ...series, metric: series.metric, values: capDonutSlices(series.values) },
      total,
    } satisfies DonutVisualizationSpec;
  }

  if (!isNonEmptyString(source.metric)
    || !isNonEmptyString(source.unit)
    || !isFiniteNumber(source.value)
    || !isFiniteNumber(source.max)
    || source.max <= 0
    || source.value < 0
    || source.value > source.max) return null;

  return {
    ...base,
    type: "PROGRESS",
    metric: source.metric,
    unit: source.unit,
    value: source.value,
    max: source.max,
  } satisfies ProgressVisualizationSpec;
}

export function buildVisualizationSpecs(sources: readonly unknown[]): VisualizationSpec[] {
  return sources
    .map((source) => buildVisualizationSpec(source))
    .filter((spec): spec is VisualizationSpec => spec !== null);
}

export function buildBlockVisualizationSpecs(block: HomeBlock): VisualizationSpec[] {
  const sources = block.payload.visualizations;
  if (!Array.isArray(sources)) return [];
  return sources
    .map((source) => buildVisualizationSpec(source, block.block_id))
    .filter((spec): spec is VisualizationSpec => spec !== null);
}

export function buildCompositionVisualizationSpecs(composition: HomeComposition): VisualizationSpec[] {
  return composition.blocks.flatMap(buildBlockVisualizationSpecs);
}

const metricTitles: Record<string, string> = {
  orders: "订单",
  sales: "销售额",
  sessions: "流量",
  cvr: "CVR",
  ad_spend: "广告花费",
  ad_sales: "广告销售额",
  acos: "ACOS",
  cpc: "CPC",
  ctr: "CTR",
  contribution_profit: "贡献利润",
  inventory_days: "库存天数",
  organic_rank: "自然排名",
};

const domainMetrics: Partial<Record<OperatingDomainId, string[]>> = {
  SALES_CONVERSION: ["orders", "sales", "cvr", "sessions"],
  ADVERTISING: ["acos", "ad_spend", "cpc", "ctr", "cvr"],
  INVENTORY_PROFIT: ["contribution_profit", "inventory_days"],
  SEARCH_RANKING: ["organic_rank"],
};

export type DomainVisualizationModel = {
  primary: LineVisualizationSpec | BarVisualizationSpec | ProgressVisualizationSpec;
  selectors: Array<{ metric: string; label: string; spec: LineVisualizationSpec }>;
  secondary: BarVisualizationSpec | DonutVisualizationSpec | ProgressVisualizationSpec | null;
};

/** Maps the read-only API envelope to the registered chart contract. */
export function buildHomeVisualizationSpecs(response: HomeVisualizationsResponse): VisualizationSpec[] {
  const sources: unknown[] = [];
  for (const item of response.metric_series ?? []) {
    sources.push({
      type: "LINE",
      title: `${metricTitles[item.metric] ?? item.metric} · ${item.lookback_days}D`,
      subtitle: item.maturity === "PROVISIONAL" ? "归因尚未成熟" : undefined,
      data_source: item.source.join(", "),
      period: formatDataPeriod(item.data_period),
      synthetic: item.synthetic,
      evidence_refs: item.evidence_refs,
      updated_at: item.updated_at,
      confidence: item.confidence,
      limitations: item.limitations,
      series: { metric: item.metric, unit: normalizeUnit(item.unit), points: item.points },
      y_axis_direction: item.metric === "organic_rank" ? "INVERTED" : "NORMAL",
    });
  }
  for (const item of response.top_entities ?? []) {
    sources.push({
      type: "BAR",
      title: `Top ${Math.min(item.entities.length, 5)} ASIN · ${metricTitles[item.metric] ?? item.metric}`,
      subtitle: `${item.lookback_days} 天确定性汇总`,
      data_source: item.source.join(", "),
      period: formatDataPeriod(item.data_period),
      synthetic: item.synthetic,
      evidence_refs: item.evidence_refs,
      updated_at: item.updated_at,
      confidence: item.confidence,
      limitations: item.limitations,
      series: {
        metric: `${item.metric}_by_asin`,
        unit: normalizeUnit(item.unit),
        values: item.entities.map((entity) => ({ label: entity.label, value: entity.value })),
      },
    });
  }
  for (const item of response.mix_breakdowns ?? []) {
    sources.push({
      type: "DONUT",
      title: `${metricTitles[item.metric] ?? item.metric}构成`,
      subtitle: `按 ASIN · ${item.lookback_days} 天`,
      data_source: item.source.join(", "),
      period: formatDataPeriod(item.data_period),
      synthetic: item.synthetic,
      evidence_refs: item.evidence_refs,
      updated_at: item.updated_at,
      confidence: item.confidence,
      limitations: item.limitations,
      series: {
        metric: `${item.metric}_by_asin`,
        unit: normalizeUnit(item.unit),
        values: item.categories.map((category) => ({
          label: category.label === "Other" ? "其他" : category.label,
          value: category.value,
        })),
      },
    });
  }
  return buildVisualizationSpecs(sources);
}

export function buildMetricSparklineSpec(label: string, specs: readonly VisualizationSpec[]): SparklineVisualizationSpec | null {
  const metric = ({ 订单: "orders", 销售额: "sales", 流量: "sessions", CVR: "cvr", ACOS: "acos", 花费: "ad_spend", 广告销售额: "ad_sales", CPC: "cpc" } as Record<string, string>)[label];
  const source = specs.find((spec): spec is LineVisualizationSpec => spec.type === "LINE" && spec.series.metric === metric);
  if (!source) return null;
  return buildVisualizationSpec({
    ...source,
    type: "SPARKLINE",
    title: `${label} 7 日趋势`,
    window: 7,
  }) as SparklineVisualizationSpec | null;
}

export function buildDomainVisualizationModel(domainId: OperatingDomainId, specs: readonly VisualizationSpec[]): DomainVisualizationModel | null {
  const preferred = domainMetrics[domainId] ?? [];
  const selectors = preferred.flatMap((metric) => {
    const spec = specs.find((candidate): candidate is LineVisualizationSpec => candidate.type === "LINE" && candidate.series.metric === metric);
    return spec ? [{ metric, label: metricTitles[metric] ?? metric, spec }] : [];
  });
  const salesSecondary = domainId === "SALES_CONVERSION"
    ? specs.find((candidate): candidate is DonutVisualizationSpec => candidate.type === "DONUT" && ["sales_by_asin", "orders_by_asin"].includes(candidate.series.metric))
      ?? specs.find((candidate): candidate is BarVisualizationSpec => candidate.type === "BAR" && ["sales_by_asin", "orders_by_asin"].includes(candidate.series.metric))
      ?? null
    : null;
  const inventorySupporting = domainId === "INVENTORY_PROFIT"
    ? specs.find((candidate): candidate is BarVisualizationSpec | ProgressVisualizationSpec =>
      (candidate.type === "BAR" && candidate.series.metric === "inventory_days_by_asin")
      || (candidate.type === "PROGRESS" && candidate.metric === "inventory_days")) ?? null
    : null;
  const secondary = salesSecondary ?? inventorySupporting;
  const standalonePrimary = inventorySupporting;
  const usingStandalonePrimary = selectors.length === 0;
  const primary: DomainVisualizationModel["primary"] | null = usingStandalonePrimary ? standalonePrimary : selectors[0].spec;
  if (!primary) return null;
  return { primary, selectors, secondary: usingStandalonePrimary ? null : secondary };
}

function formatDataPeriod(period: { start: string; end: string }) {
  return `${period.start.slice(0, 10)} – ${period.end.slice(0, 10)}`;
}

function normalizeUnit(unit: string) {
  return ({ PERCENT: "percent", COUNT: "count", DAYS: "days", USD_PER_CLICK: "USD" } as Record<string, string>)[unit] ?? unit;
}

function hasValidMetadata(source: Record<string, unknown>): source is Record<string, unknown> & {
  title: string;
  data_source: string;
  period: string;
  synthetic: boolean;
} {
  return isNonEmptyString(source.title)
    && isNonEmptyString(source.data_source)
    && isNonEmptyString(source.period)
    && typeof source.synthetic === "boolean";
}

function readTimeSeries(value: unknown): TimeSeries | null {
  if (!isRecord(value)
    || !isNonEmptyString(value.metric)
    || !isNonEmptyString(value.unit)
    || !Array.isArray(value.points)
    || value.points.length === 0) return null;

  const points = value.points.map((point) => {
    if (!isRecord(point) || !isNonEmptyString(point.period) || !isFiniteNumber(point.value)) return null;
    return { period: point.period, value: point.value };
  });
  if (points.some((point) => point === null)) return null;
  return { metric: value.metric, unit: value.unit, points: points as TimeSeries["points"] };
}

function readCategorySeries(value: unknown, options: { nonNegative?: boolean } = {}): CategorySeries | null {
  if (!isRecord(value)
    || !isNonEmptyString(value.metric)
    || !isNonEmptyString(value.unit)
    || !Array.isArray(value.values)
    || value.values.length === 0) return null;

  const labels = new Set<string>();
  const values = value.values.map((item) => {
    if (!isRecord(item)
      || !isNonEmptyString(item.label)
      || !isFiniteNumber(item.value)
      || (options.nonNegative && item.value < 0)
      || labels.has(item.label)) return null;
    labels.add(item.label);
    return { label: item.label, value: item.value };
  });
  if (values.some((item) => item === null)) return null;
  return { metric: value.metric, unit: value.unit, values: values as CategoryValue[] };
}

function capDonutSlices(values: CategoryValue[]): CategoryValue[] {
  if (values.length <= 5) return values;

  const ranked = values
    .filter((item) => item.label !== "其他")
    .map((item, index) => ({ ...item, index }))
    .sort((left, right) => right.value - left.value || left.index - right.index);
  const primaryLabels = new Set(ranked.slice(0, 4).map((item) => item.label));
  const primary = ranked.slice(0, 4).map(({ label, value }) => ({ label, value }));
  const other = values.reduce((sum, item) => sum + (primaryLabels.has(item.label) ? 0 : item.value), 0);
  return [...primary, { label: "其他", value: other }];
}

function readSparklineWindow(value: unknown): SparklineWindow | null {
  if (value === undefined || value === 7) return 7;
  return value === 14 ? 14 : null;
}

function isVisualizationType(value: unknown): value is VisualizationType {
  return typeof value === "string" && visualizationTypes.has(value);
}

function isPartToWholeMetric(value: string): value is PartToWholeMetric {
  return partToWholeMetrics.has(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isEvidenceReferenceArray(value: unknown): value is Array<{ kind: "METRIC" | "TOOL_OUTPUT" | "RAW_RECORD" | "POLICY" | "DOCUMENT" | "ANOMALY"; reference_id: string }> {
  const kinds = new Set(["METRIC", "TOOL_OUTPUT", "RAW_RECORD", "POLICY", "DOCUMENT", "ANOMALY"]);
  return Array.isArray(value) && value.every((item) => isRecord(item) && typeof item.kind === "string" && kinds.has(item.kind) && isNonEmptyString(item.reference_id));
}
