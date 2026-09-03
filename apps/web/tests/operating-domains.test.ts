import { describe, expect, it } from "vitest";
import type { ComponentType, HomeBlock } from "../types/home";
import { buildOperatingDomains, operatingDomainForBlock } from "../view-models/operating-domains";
import { homeBlock, homeComposition } from "./fixtures/home";

describe("OperatingDomain mapping", () => {
  it.each<[ComponentType, string]>([
    ["executive_summary", "SALES_CONVERSION"],
    ["critical_alert", "SALES_CONVERSION"],
    ["order_funnel", "SALES_CONVERSION"],
    ["ad_diagnosis", "ADVERTISING"],
    ["experiment_result", "PRODUCT_LISTING"],
    ["inventory_risk", "INVENTORY_PROFIT"],
    ["profit_simulation", "INVENTORY_PROFIT"],
    ["keyword_opportunity", "SEARCH_RANKING"],
    ["competitor_change", "MARKET_OPPORTUNITY"],
    ["product_opportunity", "MARKET_OPPORTUNITY"],
    ["policy_alert", "MARKET_OPPORTUNITY"],
    ["news_impact", "MARKET_OPPORTUNITY"],
  ])("maps %s deterministically", (componentType, domainId) => {
    expect(operatingDomainForBlock(homeBlock({ component_type: componentType }))).toBe(domainId);
  });

  it("never maps duplicated action, follow-up, or approval blocks", () => {
    expect(operatingDomainForBlock(homeBlock({ component_type: "priority_action" }))).toBeNull();
    expect(operatingDomainForBlock(homeBlock({ component_type: "follow_up_question" }))).toBeNull();
    expect(operatingDomainForBlock(homeBlock({ component_type: "approval_request" }))).toBeNull();
  });

  it("always returns six domains and auto-expands only the highest critical domain", () => {
    const domains = buildOperatingDomains(homeComposition());

    expect(new Set(domains.map((domain) => domain.id))).toHaveLength(6);
    expect(domains[0]).toMatchObject({ id: "SALES_CONVERSION", status: "CRITICAL", defaultExpanded: true });
    expect(domains.find((domain) => domain.id === "ADVERTISING")).toMatchObject({ status: "ATTENTION", defaultExpanded: false });
    expect(domains.filter((domain) => domain.defaultExpanded)).toHaveLength(1);
    expect(domains.filter((domain) => domain.status === "NO_DATA").every((domain) => !domain.defaultExpanded)).toBe(true);
  });

  it("expands only sales when the composition has no anomaly", () => {
    const funnel: HomeBlock = homeBlock({
      component_type: "order_funnel",
      payload: { sessions: 100, orders: 10, unit_session_percentage: 10 },
    });
    const domains = buildOperatingDomains(homeComposition({
      home_state: "NORMAL",
      data_status: { ...homeComposition().data_status, status: "COMPLETE" },
      blocks: [funnel],
    }));

    expect(domains.find((domain) => domain.id === "SALES_CONVERSION")).toMatchObject({ status: "STABLE", defaultExpanded: true });
    expect(domains.filter((domain) => domain.defaultExpanded).map((domain) => domain.id)).toEqual(["SALES_CONVERSION"]);
  });

  it("maps generic blocks only through closed machine-field prefixes", () => {
    const sales = homeBlock({ component_type: "data_table", payload: { data_ref: "postgres:store-day:test" } });
    const unknown = homeBlock({ component_type: "data_table", payload: { data_ref: "opaque:future:test" } });

    expect(operatingDomainForBlock(sales)).toBe("SALES_CONVERSION");
    expect(operatingDomainForBlock(unknown)).toBeNull();
  });
});
