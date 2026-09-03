import type { ActionSummary, HomeComposition, HomeState, ObjectiveProfile } from "../types/home";
import { buildOperatingDomains, type DomainMetric, type OperatingDomain } from "./operating-domains";

export type HomeViewModel = {
  businessDate: string;
  marketplaceLabel: string;
  judgment: string;
  explanation: string;
  metadata: string;
  metrics: DomainMetric[];
  actions: ActionSummary[];
  hasMoreActions: boolean;
  quickQuestions: string[];
  domains: OperatingDomain[];
};

export function buildHomeViewModel(composition: HomeComposition): HomeViewModel {
  const domains = buildOperatingDomains(composition);
  return {
    businessDate: composition.business_date,
    marketplaceLabel: marketplaceLabel(composition.marketplace),
    judgment: composition.top_issue.summary,
    explanation: composition.overall_judgment,
    metadata: [
      objectiveLabel(composition.objective_profile),
      dataStatusLabel(composition.data_status.status),
      `更新于 ${formatUpdateTime(composition.data_status.updated_at)}`,
    ].join(" · "),
    metrics: summaryMetrics(composition, domains).slice(0, 4),
    actions: [...composition.top_actions].sort((left, right) => left.priority - right.priority).slice(0, 3),
    hasMoreActions: composition.top_actions.length > 3,
    quickQuestions: quickQuestionsForState(composition.home_state).slice(0, 3),
    domains,
  };
}

export function hasUsableHomeContent(composition: HomeComposition) {
  const view = buildHomeViewModel(composition);
  return view.metrics.length > 0
    || view.actions.length > 0
    || view.domains.some((domain) => domain.blocks.length > 0);
}

function summaryMetrics(composition: HomeComposition, domains: OperatingDomain[]) {
  const all = domains.flatMap((domain) => domain.metrics);
  const byLabel = new Map(all.map((metric) => [metric.label, metric]));
  const inventoryRisk = composition.home_state === "INVENTORY_PROFIT_RISK";
  const preferred = inventoryRisk
    ? ["订单", "库存天数", "销售额", "贡献利润"]
    : ({
        LAUNCH_GROWTH: ["订单", "核心词曝光", "点击", "CVR"],
        SCALE_GROWTH: ["订单", "销售额", "ACOS", "库存天数"],
        HARVEST_PROFIT: ["销售额", "贡献利润", "利润率", "TACOS"],
        RECOVERY_RANK: ["订单", "CVR", "流量", "ACOS"],
        MIXED_STORE: ["订单", "销售额", "ACOS", "CVR"],
      } satisfies Record<ObjectiveProfile, string[]>)[composition.objective_profile];

  const selected = preferred.map((label) => byLabel.get(label)).filter((metric): metric is DomainMetric => Boolean(metric));
  for (const metric of all) {
    if (selected.length >= 4) break;
    if (!selected.some((current) => current.label === metric.label)) selected.push(metric);
  }
  return selected;
}

function quickQuestionsForState(state: HomeState) {
  return ({
    NORMAL: ["今天还有什么增长机会？", "哪个 ASIN 值得加预算？", "正在进行的实验表现如何？"],
    ORDER_AD_ANOMALY: ["为什么广告成本上涨？", "哪些搜索词最浪费？", "现在应该调整预算吗？"],
    INVENTORY_PROFIT_RISK: ["哪个 ASIN 最危险？", "还能卖多少天？", "什么时候补货？"],
    MARKET_POLICY_CHANGE: ["哪些 ASIN 会受影响？", "现在需要采取什么行动？", "有什么新的市场机会？"],
    DATA_INCOMPLETE: ["哪些数据还没有同步？", "当前哪些结论不可靠？", "什么时候可以重新分析？"],
  } as const)[state];
}

function marketplaceLabel(value: string) {
  return value === "ATVPDKIKX0DER" ? "Amazon 美国站" : value;
}

function formatUpdateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  }).format(new Date(value));
}

function objectiveLabel(value: ObjectiveProfile) {
  return ({
    LAUNCH_GROWTH: "新品冷启动",
    SCALE_GROWTH: "稳定放量",
    HARVEST_PROFIT: "利润收割",
    RECOVERY_RANK: "排名恢复",
    MIXED_STORE: "混合经营阶段",
  } as const)[value];
}

function dataStatusLabel(value: string) {
  return ({ COMPLETE: "数据已成熟", PROVISIONAL: "数据尚在归因", STALE: "数据待更新", INCOMPLETE: "数据不完整" } as Record<string, string>)[value] ?? value;
}
