import { describe, expect, it } from "vitest";
import type { ActionSummary, HomeBlock } from "../types/home";
import { buildHomeViewModel } from "../view-models/home";
import { homeBlock, homeComposition } from "./fixtures/home";

describe("HomeViewModel", () => {
  it("caps overview metrics, actions, and quick questions", () => {
    const actions = [5, 2, 4, 1, 3].map(action);
    const view = buildHomeViewModel(homeComposition({ top_actions: actions }));

    expect(view.metrics.map((metric) => metric.label)).toEqual(["订单", "CVR", "流量", "ACOS"]);
    expect(view.metrics).toHaveLength(4);
    expect(view.actions.map((item) => item.priority)).toEqual([1, 2, 3]);
    expect(view.hasMoreActions).toBe(true);
    expect(view.quickQuestions).toHaveLength(3);
  });

  it("uses objective-specific metrics without inventing missing values", () => {
    const blocks: HomeBlock[] = [
      homeBlock({ component_type: "executive_summary", payload: { sales: 1846 } }),
      homeBlock({
        block_id: "10000000-0000-4000-8000-000000000010",
        component_type: "profit_simulation",
        payload: { contribution_profit: 345, margin: 18.7, tacos: 12.4 },
      }),
    ];
    const view = buildHomeViewModel(homeComposition({ objective_profile: "HARVEST_PROFIT", blocks }));

    expect(view.metrics.map((metric) => metric.label)).toEqual(["销售额", "贡献利润", "利润率", "TACOS"]);
    expect(view.metrics.map((metric) => metric.value)).toEqual(["$1,846", "$345", "18.7%", "12.4%"]);
  });

  it("does not duplicate presentation-only blocks in operating domains", () => {
    const view = buildHomeViewModel(homeComposition());
    const domainBlocks = view.domains.flatMap((domain) => domain.blocks);

    expect(domainBlocks.some((block) => block.component_type === "priority_action")).toBe(false);
    expect(domainBlocks.some((block) => block.component_type === "follow_up_question")).toBe(false);
    expect(new Set(domainBlocks.map((block) => block.block_id)).size).toBe(domainBlocks.length);
    expect(view.metadata).toContain("排名恢复");
    expect(view.metadata).toContain("数据尚在归因");
  });

  it("changes quick questions with the home state", () => {
    const ads = buildHomeViewModel(homeComposition({ home_state: "ORDER_AD_ANOMALY" }));
    const inventory = buildHomeViewModel(homeComposition({ home_state: "INVENTORY_PROFIT_RISK" }));

    expect(ads.quickQuestions).toContain("哪些搜索词最浪费？");
    expect(inventory.quickQuestions).toContain("还能卖多少天？");
    expect(ads.quickQuestions).not.toEqual(inventory.quickQuestions);
  });
});

function action(priority: number): ActionSummary {
  return {
    action_id: `30000000-0000-4000-8000-${String(priority).padStart(12, "0")}`,
    priority,
    title: `行动 ${priority}`,
    action_type: "CREATE_REVIEW_DRAFT",
    reason: "只读建议。",
    requires_approval: true,
    evidence_refs: [],
  };
}
