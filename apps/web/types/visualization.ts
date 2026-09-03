import type { DataPeriod, EvidenceReference, HomeBlock } from "./home";

export const VISUALIZATION_TYPES = ["SPARKLINE", "LINE", "BAR", "DONUT", "PROGRESS"] as const;

export type VisualizationType = (typeof VISUALIZATION_TYPES)[number];
export type SparklineWindow = 7 | 14;

export type TimeSeriesPoint = {
  period: string;
  value: number;
};

export type TimeSeries = {
  metric: string;
  unit: string;
  points: TimeSeriesPoint[];
};

export type CategoryValue = {
  label: string;
  value: number;
};

export type CategorySeries = {
  metric: string;
  unit: string;
  values: CategoryValue[];
};

export const PART_TO_WHOLE_METRICS = [
  "sales_by_asin",
  "orders_by_asin",
  "ad_spend_by_campaign",
  "ad_sales_by_campaign",
  "revenue_by_product_group",
] as const;

export type PartToWholeMetric = (typeof PART_TO_WHOLE_METRICS)[number];

type VisualizationSourceBase = {
  title: string;
  subtitle?: string;
  data_source: string;
  period: string;
  synthetic: boolean;
  evidence_refs?: EvidenceReference[];
  updated_at?: string;
  confidence?: number;
  limitations?: string[];
};

export type TimeSeriesVisualizationSource = VisualizationSourceBase & {
  type: "SPARKLINE" | "LINE";
  series: TimeSeries;
  window?: SparklineWindow;
  y_axis_direction?: "NORMAL" | "INVERTED";
};

export type CategoryVisualizationSource = VisualizationSourceBase & {
  type: "BAR" | "DONUT";
  series: CategorySeries;
};

export type ProgressVisualizationSource = VisualizationSourceBase & {
  type: "PROGRESS";
  metric: string;
  unit: string;
  value: number;
  max: number;
};

export type VisualizationSource =
  | TimeSeriesVisualizationSource
  | CategoryVisualizationSource
  | ProgressVisualizationSource;

type VisualizationSpecBase = VisualizationSourceBase & {
  source_block_id?: HomeBlock["block_id"];
};

export type SparklineVisualizationSpec = VisualizationSpecBase & {
  type: "SPARKLINE";
  series: TimeSeries;
  window: SparklineWindow;
};

export type LineVisualizationSpec = VisualizationSpecBase & {
  type: "LINE";
  series: TimeSeries;
  y_axis_direction: "NORMAL" | "INVERTED";
};

export type BarVisualizationSpec = VisualizationSpecBase & {
  type: "BAR";
  series: CategorySeries;
};

export type DonutVisualizationSpec = VisualizationSpecBase & {
  type: "DONUT";
  series: CategorySeries & { metric: PartToWholeMetric };
  total: number;
};

export type ProgressVisualizationSpec = VisualizationSpecBase & {
  type: "PROGRESS";
  metric: string;
  unit: string;
  value: number;
  max: number;
};

export type VisualizationSpec =
  | SparklineVisualizationSpec
  | LineVisualizationSpec
  | BarVisualizationSpec
  | DonutVisualizationSpec
  | ProgressVisualizationSpec;

type EvidenceBackedVisualization = {
  evidence_refs: EvidenceReference[];
  data_period: DataPeriod;
  source: string[];
  updated_at: string;
  confidence: number;
  limitations: string[];
  synthetic: boolean;
};

export type MetricSeriesVisualization = EvidenceBackedVisualization & {
  metric: string;
  scope: "STORE";
  unit: string;
  lookback_days: number;
  maturity: string;
  points: TimeSeriesPoint[];
};

export type TopEntitiesVisualization = EvidenceBackedVisualization & {
  metric: "orders" | "sales" | "sessions";
  scope: "STORE";
  entity_type: "ASIN";
  unit: string;
  lookback_days: number;
  entities: Array<{ rank: number; entity_id: string; label: string; value: number }>;
};

export type MixBreakdownVisualization = EvidenceBackedVisualization & {
  metric: "orders" | "sales";
  scope: "STORE";
  entity_type: "ASIN";
  unit: string;
  lookback_days: number;
  total: number;
  categories: Array<{ label: string; value: number; share_pct: number; entity_id?: string | null }>;
};

export type HomeVisualizationsResponse = {
  business_date: string;
  marketplace: string;
  lookback_days: number;
  metric_series: MetricSeriesVisualization[];
  top_entities: TopEntitiesVisualization[];
  mix_breakdowns: MixBreakdownVisualization[];
  synthetic: boolean;
};
