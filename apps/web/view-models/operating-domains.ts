import type { ComponentType, HomeBlock, HomeComposition } from "../types/home";

export type OperatingDomainId =
  | "SALES_CONVERSION"
  | "ADVERTISING"
  | "PRODUCT_LISTING"
  | "INVENTORY_PROFIT"
  | "SEARCH_RANKING"
  | "MARKET_OPPORTUNITY";

export type OperatingDomainStatus = "CRITICAL" | "ATTENTION" | "STABLE" | "POSITIVE" | "NO_DATA";

export type DomainMetric = {
  label: string;
  value: string;
  note?: string;
  tone?: "risk" | "positive";
};

export type OperatingDomain = {
  id: OperatingDomainId;
  title: string;
  status: OperatingDomainStatus;
  priority: number;
  summary: string;
  metrics: DomainMetric[];
  blocks: HomeBlock[];
  defaultExpanded: boolean;
};

const DOMAIN_ORDER: OperatingDomainId[] = [
  "SALES_CONVERSION",
  "ADVERTISING",
  "PRODUCT_LISTING",
  "INVENTORY_PROFIT",
  "SEARCH_RANKING",
  "MARKET_OPPORTUNITY",
];

const DOMAIN_TITLES: Record<OperatingDomainId, string> = {
  SALES_CONVERSION: "销售与转化",
  ADVERTISING: "广告",
  PRODUCT_LISTING: "商品与 Listing",
  INVENTORY_PROFIT: "库存与利润",
  SEARCH_RANKING: "搜索与排名",
  MARKET_OPPORTUNITY: "市场与机会",
};

const DOMAIN_BY_COMPONENT: Partial<Record<ComponentType, OperatingDomainId>> = {
  executive_summary: "SALES_CONVERSION",
  critical_alert: "SALES_CONVERSION",
  order_funnel: "SALES_CONVERSION",
  ad_diagnosis: "ADVERTISING",
  experiment_result: "PRODUCT_LISTING",
  inventory_risk: "INVENTORY_PROFIT",
  profit_simulation: "INVENTORY_PROFIT",
  keyword_opportunity: "SEARCH_RANKING",
  competitor_change: "MARKET_OPPORTUNITY",
  product_opportunity: "MARKET_OPPORTUNITY",
  policy_alert: "MARKET_OPPORTUNITY",
  news_impact: "MARKET_OPPORTUNITY",
};

const GENERIC_COMPONENTS: ComponentType[] = ["metric_card", "line_chart", "comparison_chart", "data_table", "positive_signal"];

const STATUS_ORDER: Record<OperatingDomainStatus, number> = {
  CRITICAL: 0,
  ATTENTION: 1,
  POSITIVE: 2,
  STABLE: 3,
  NO_DATA: 4,
};

export function operatingDomainForBlock(block: HomeBlock): OperatingDomainId | null {
  if (["priority_action", "follow_up_question", "approval_request"].includes(block.component_type)) return null;
  if (GENERIC_COMPONENTS.includes(block.component_type)) return domainFromMachineFields(block);
  return DOMAIN_BY_COMPONENT[block.component_type] ?? null;
}

export function buildOperatingDomains(composition: HomeComposition): OperatingDomain[] {
  const grouped = new Map<OperatingDomainId, HomeBlock[]>(DOMAIN_ORDER.map((id) => [id, []]));
  for (const block of composition.blocks) {
    const domainId = operatingDomainForBlock(block);
    if (domainId) grouped.get(domainId)?.push(block);
  }

  const domains = DOMAIN_ORDER.map((id, index): OperatingDomain => {
    const blocks = [...(grouped.get(id) ?? [])].sort((left, right) => left.priority - right.priority);
    return {
      id,
      title: DOMAIN_TITLES[id],
      status: statusForDomain(id, blocks, composition),
      priority: blocks[0]?.priority ?? 100 + index,
      summary: summaryForDomain(id, blocks, composition),
      metrics: metricsForDomain(id, blocks),
      blocks,
      defaultExpanded: false,
    };
  }).sort((left, right) =>
    STATUS_ORDER[left.status] - STATUS_ORDER[right.status]
    || left.priority - right.priority
    || DOMAIN_ORDER.indexOf(left.id) - DOMAIN_ORDER.indexOf(right.id));

  const expanded = defaultExpandedDomainIds(domains);
  return domains.map((domain) => ({ ...domain, defaultExpanded: expanded.includes(domain.id) }));
}

export function defaultExpandedDomainIds(domains: OperatingDomain[]): OperatingDomainId[] {
  const critical = domains.filter((domain) => domain.status === "CRITICAL").slice(0, 2);
  const selected = [...critical];

  if (selected.length < 2) {
    const attention = domains.find((domain) => domain.status === "ATTENTION");
    if (attention && !selected.some((domain) => domain.id === attention.id)) selected.push(attention);
  }

  if (selected.length === 0) {
    const sales = domains.find((domain) => domain.id === "SALES_CONVERSION");
    if (sales) selected.push(sales);
  }

  return selected.slice(0, 2).map((domain) => domain.id);
}

export function detailBlocksForDomain(domain: OperatingDomain): HomeBlock[] {
  return domain.blocks
    .filter((block) => !["executive_summary", "critical_alert", "metric_card", "data_table", "positive_signal"].includes(block.component_type))
    .slice(0, 5);
}

export function domainStatusLabel(status: OperatingDomainStatus) {
  return ({
    CRITICAL: "高优先级",
    ATTENTION: "需要关注",
    STABLE: "稳定",
    POSITIVE: "正向信号",
    NO_DATA: "暂无信号",
  } as const)[status];
}

function statusForDomain(id: OperatingDomainId, blocks: HomeBlock[], composition: HomeComposition): OperatingDomainStatus {
  if (blocks.length === 0) return "NO_DATA";
  const severities = blocks.map((block) => String(block.payload.severity ?? "").toUpperCase());
  if (severities.includes("CRITICAL") || blocks.some((block) => block.component_type === "critical_alert")) return "CRITICAL";
  if (severities.some((severity) => ["HIGH", "WARNING", "ATTENTION"].includes(severity))) return "ATTENTION";
  if (blocks.some((block) => ["inventory_risk", "profit_simulation", "competitor_change", "policy_alert", "news_impact"].includes(block.component_type))) return "ATTENTION";
  if (id === "SALES_CONVERSION" && composition.home_state === "ORDER_AD_ANOMALY") return "ATTENTION";
  if (id === "ADVERTISING" && composition.data_status.status !== "COMPLETE") return "ATTENTION";
  if (id === "INVENTORY_PROFIT" && composition.home_state === "INVENTORY_PROFIT_RISK") return "ATTENTION";
  if (id === "MARKET_OPPORTUNITY" && composition.home_state === "MARKET_POLICY_CHANGE") return "ATTENTION";
  if (blocks.some((block) => ["positive_signal", "keyword_opportunity", "product_opportunity"].includes(block.component_type))) return "POSITIVE";
  return "STABLE";
}

function domainFromMachineFields(block: HomeBlock): OperatingDomainId | null {
  const machineValue = [block.payload.metric, block.payload.data_ref, block.payload.domain]
    .filter((value): value is string => typeof value === "string")
    .join(":")
    .toLowerCase();
  if (/retail|store-day|sales|traffic|order/.test(machineValue)) return "SALES_CONVERSION";
  if (/ads|campaign|search_term|targeting/.test(machineValue)) return "ADVERTISING";
  if (/listing|pricing|offer|review|experiment/.test(machineValue)) return "PRODUCT_LISTING";
  if (/inventory|finance|profit|margin|inbound/.test(machineValue)) return "INVENTORY_PROFIT";
  if (/keyword|ranking|search_query/.test(machineValue)) return "SEARCH_RANKING";
  if (/competitor|market|policy|news|opportunity/.test(machineValue)) return "MARKET_OPPORTUNITY";
  return block.component_type === "positive_signal" ? "SALES_CONVERSION" : null;
}

function summaryForDomain(id: OperatingDomainId, blocks: HomeBlock[], composition: HomeComposition) {
  const primary = blocks[0];
  const payloadSummary = primary?.payload.summary;
  const payloadFinding = primary?.payload.finding;
  if (typeof payloadSummary === "string") return payloadSummary;
  if (typeof payloadFinding === "string") return payloadFinding;
  if (primary) return primary.display_reason;

  return ({
    SALES_CONVERSION: composition.overall_judgment,
    ADVERTISING: "当前没有新的广告异常信号。",
    PRODUCT_LISTING: "当前没有需要优先处理的 Listing 信号。",
    INVENTORY_PROFIT: "当前没有新的库存或利润风险信号。",
    SEARCH_RANKING: "当前没有新的关键词排名信号。",
    MARKET_OPPORTUNITY: "当前没有新的市场或选品信号。",
  } as const)[id];
}

function metricsForDomain(id: OperatingDomainId, blocks: HomeBlock[]): DomainMetric[] {
  const executive = find(blocks, "executive_summary");
  const critical = find(blocks, "critical_alert");
  const funnel = find(blocks, "order_funnel");
  const ads = find(blocks, "ad_diagnosis");
  const inventory = find(blocks, "inventory_risk");
  const profit = find(blocks, "profit_simulation");
  const keyword = find(blocks, "keyword_opportunity");

  if (id === "SALES_CONVERSION") return compact([
    metric("订单", numberFrom(executive, "orders") ?? numberFrom(critical, "observed_value"), "number", deltaFrom(executive, critical)),
    metric("CVR", numberFrom(funnel, "unit_session_percentage"), "percent"),
    metric("流量", numberFrom(funnel, "sessions"), "number"),
    metric("销售额", numberFrom(executive, "sales"), "currency"),
  ]);
  if (id === "ADVERTISING") return compact([
    metric("ACOS", numberFrom(ads, "acos"), "percent"),
    metric("花费", numberFrom(ads, "spend"), "currency"),
    metric("广告销售额", numberFrom(ads, "ad_sales"), "currency"),
    metric("CPC", numberFrom(ads, "cpc"), "currency"),
  ]);
  if (id === "INVENTORY_PROFIT") return compact([
    metric("库存天数", numberFrom(inventory, "inventory_days"), "days"),
    metric("贡献利润", numberFrom(profit, "contribution_profit"), "currency"),
    metric("利润率", numberFrom(profit, "margin"), "percent"),
    metric("TACOS", numberFrom(profit, "tacos"), "percent"),
  ]);
  if (id === "SEARCH_RANKING") return compact([
    metric("自然排名", numberFrom(keyword, "organic_rank"), "rank"),
    metric("广告排名", numberFrom(keyword, "ad_rank"), "rank"),
    metric("点击份额", numberFrom(keyword, "click_share"), "percent"),
  ]);
  return compact(blocks.flatMap(genericMetrics)).slice(0, 4);
}

function genericMetrics(block: HomeBlock): Array<DomainMetric | null> {
  return [
    metric("影响 ASIN", numberFrom(block, "affected_asins"), "number"),
    metric("机会分", numberFrom(block, "score"), "number"),
    metric("置信度", block.confidence * 100, "percent"),
  ];
}

function find(blocks: HomeBlock[], type: ComponentType) {
  return blocks.find((block) => block.component_type === type);
}

function numberFrom(block: HomeBlock | undefined, key: string) {
  const value = block?.payload[key];
  return typeof value === "number" ? value : null;
}

function deltaFrom(executive: HomeBlock | undefined, critical: HomeBlock | undefined) {
  return numberFrom(executive, "orders_delta_pct") ?? numberFrom(critical, "delta_pct");
}

function metric(label: string, value: number | null, format: "number" | "currency" | "percent" | "days" | "rank", delta?: number | null): DomainMetric | null {
  if (value === null) return null;
  const formatted = format === "currency"
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
    : format === "percent"
      ? `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)}%`
      : format === "days"
        ? `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)} 天`
        : format === "rank"
          ? `#${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)}`
          : new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
  return {
    label,
    value: formatted,
    note: delta == null ? undefined : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`,
    tone: delta == null ? undefined : delta < 0 ? "risk" : "positive",
  };
}

function compact(values: Array<DomainMetric | null>) {
  return values.filter((value): value is DomainMetric => value !== null).slice(0, 4);
}
