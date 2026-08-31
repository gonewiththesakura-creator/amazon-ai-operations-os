export type HomeMode = "NORMAL" | "ORDER_AD_ANOMALY";

export type CompositionBlock =
  | { type: "health"; id: string; label: string; value: string; detail: string; tone: "good" | "warn" | "neutral" }
  | { type: "brief"; id: string; eyebrow: string; title: string; body: string; status: "ON_TRACK" | "BELOW_EXPECTATION" | "NO_ORDERS" | "DATA_INCOMPLETE" }
  | { type: "metrics"; id: string; items: Array<{ label: string; value: string; delta: string; trend: "up" | "down" | "flat" }> }
  | { type: "causes"; id: string; title: string; subtitle: string; items: Array<{ label: string; score: number; note: string; tone: "positive" | "negative" | "neutral" }> }
  | { type: "actions"; id: string; title: string; items: Array<{ id: string; priority: string; title: string; target: string; impact: string; risk: string; cta: string }> }
  | { type: "evidence"; id: string; title: string; rows: Array<{ label: string; value: string; source: string; state: string }> };

export type ComponentBlock = CompositionBlock;

export type HomeComposition = {
  id: string;
  version: "home.v1";
  mode: HomeMode;
  label: string;
  description: string;
  blocks: CompositionBlock[];
};

const normal: HomeComposition = {
  id: "home-normal",
  version: "home.v1",
  mode: "NORMAL",
  label: "今日简报",
  description: "经营日运行稳定，仍有可控的增量空间。",
  blocks: [
    { type: "health", id: "health", label: "数据管道健康度", value: "98.6%", detail: "12 分钟前更新", tone: "good" },
    { type: "health", id: "freshness", label: "数据成熟度", value: "MATURED", detail: "零售与广告口径一致", tone: "neutral" },
    { type: "health", id: "connections", label: "连接状态", value: "SIMULATED", detail: "0 个写入能力", tone: "warn" },
    { type: "brief", id: "brief", eyebrow: "8 月 31 日 · America/Los_Angeles", title: "需求健康，选择性放量", body: "订单高于 28 天基线。最清晰的增量来自一个受预算限制的广告活动，同时库存仍是放量前置条件。", status: "ON_TRACK" },
    { type: "metrics", id: "metrics", items: [
      { label: "订单", value: "184", delta: "+12.4%", trend: "up" },
      { label: "净销售额", value: "$8,420", delta: "+8.1%", trend: "up" },
      { label: "广告花费", value: "$1,126", delta: "−3.2%", trend: "down" },
      { label: "贡献利润", value: "$2,988", delta: "+14.7%", trend: "up" }
    ] },
    { type: "causes", id: "causes", title: "今天的变化来自哪里", subtitle: "证据加权贡献 · 28 天基线", items: [
      { label: "自然需求", score: 78, note: "3 个核心词的搜索可见度上升", tone: "positive" },
      { label: "转化表现", score: 63, note: "CVR 稳定在 10.8%", tone: "positive" },
      { label: "广告供给", score: 42, note: "一个广告活动将在 16:20 达到预算", tone: "neutral" },
      { label: "库存", score: 26, note: "重点 ASIN 还有 18 天覆盖", tone: "neutral" }
    ] },
    { type: "actions", id: "actions", title: "现在最值得做什么", items: [
      { id: "act-1", priority: "01", title: "守住高效增长空间", target: "syn-campaign-014 · Sponsored Products", impact: "+8–14% 有效点击", risk: "中 · 受库存覆盖约束", cta: "查看预算草案" },
      { id: "act-2", priority: "02", title: "更新主图实验", target: "SYN-ASIN-004 · Listing", impact: "获得更清晰的转化信号", risk: "低 · 可回滚", cta: "打开实验" },
      { id: "act-3", priority: "03", title: "放量前关注入库 ETA", target: "SYN-SKU-011 · 库存", impact: "避免 6 天供货缺口", risk: "高 · 供应商延迟", cta: "查看证据" }
    ] },
    { type: "evidence", id: "evidence", title: "管道备注", rows: [
      { label: "零售日报", value: "Matured", source: "synthetic:amazon_sp_api", state: "12 分钟前" },
      { label: "广告统一报表", value: "Matured", source: "synthetic:amazon_ads", state: "32 分钟前" },
      { label: "排名快照", value: "Estimated", source: "synthetic:sellersprite", state: "2 小时前" }
    ] }
  ]
};

const anomaly: HomeComposition = {
  id: "home-order-ad-anomaly",
  version: "home.v1",
  mode: "ORDER_AD_ANOMALY",
  label: "订单 / 广告异常",
  description: "花费仍在发生但订单下降，先检查供给与可售状态。",
  blocks: [
    { type: "health", id: "health", label: "数据管道健康度", value: "94.1%", detail: "1 个来源需要复核", tone: "warn" },
    { type: "health", id: "freshness", label: "数据成熟度", value: "PROVISIONAL", detail: "广告可能在 7 天内回补", tone: "warn" },
    { type: "health", id: "connections", label: "连接状态", value: "SIMULATED", detail: "未启用 Amazon 写入", tone: "warn" },
    { type: "brief", id: "brief", eyebrow: "检测到异常 · SYN-ASIN-009", title: "订单下降，广告不是第一处置点", body: "订单较 28 天基线下降 41%，但花费基本持平。可售库存在 14:10 归零，因此库存恢复前禁止增加预算。", status: "NO_ORDERS" },
    { type: "metrics", id: "metrics", items: [
      { label: "订单", value: "0", delta: "−100%", trend: "down" },
      { label: "Sessions", value: "412", delta: "−8.6%", trend: "down" },
      { label: "广告花费", value: "$184", delta: "+1.4%", trend: "up" },
      { label: "可售库存", value: "0 units", delta: "Critical", trend: "down" }
    ] },
    { type: "causes", id: "causes", title: "证据链", subtitle: "按诊断优先级排序，而非按相关性排序", items: [
      { label: "供给 / 可售", score: 94, note: "可售库存在 14:10 归零", tone: "negative" },
      { label: "广告效率", score: 58, note: "ACOS 仍为 provisional，暂不优化", tone: "neutral" },
      { label: "流量", score: 31, note: "Sessions 下降，但不足以解释零订单", tone: "neutral" },
      { label: "转化", score: 0, note: "断货后没有有效分母", tone: "neutral" }
    ] },
    { type: "actions", id: "actions", title: "现在最值得做什么", items: [
      { id: "anomaly-1", priority: "01", title: "确认补货 ETA", target: "SYN-ASIN-009 · 入库货件", impact: "恢复可售状态", risk: "高 · ETA 未确定", cta: "打开库存证据" },
      { id: "anomaly-2", priority: "02", title: "库存恢复前暂停预算变更", target: "syn-campaign-021 · guardrail", impact: "避免断货期间浪费", risk: "低 · 无外部写入", cta: "创建复核备注" },
      { id: "anomaly-3", priority: "03", title: "归因成熟后重新检查广告", target: "7 天点击窗口 · PROVISIONAL", impact: "使用稳定 ACOS", risk: "中 · 转化可能迟到", cta: "安排复核" }
    ] },
    { type: "evidence", id: "evidence", title: "为什么这个结论仍是 provisional", rows: [
      { label: "库存快照", value: "0 fulfillable", source: "synthetic:amazon_sp_api", state: "14:10" },
      { label: "广告转化", value: "Provisional", source: "synthetic:amazon_ads", state: "7 天窗口" },
      { label: "原因状态", value: "Observed association", source: "metric:retail.orders", state: "v1.4" }
    ] }
  ]
};

export const HOME_COMPOSITIONS: Record<HomeMode, HomeComposition> = { NORMAL: normal, ORDER_AD_ANOMALY: anomaly };

export function getHomeComposition(mode: HomeMode): HomeComposition {
  return HOME_COMPOSITIONS[mode];
}
