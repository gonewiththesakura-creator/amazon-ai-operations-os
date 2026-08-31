import { describe, expect, it } from "vitest";
import { getHomeComposition, HOME_COMPOSITIONS, type HomeMode } from "../data/compositions";

const expectedTypes = ["health", "brief", "metrics", "causes", "actions", "evidence"];

describe("home composition contract", () => {
  it("exposes both versioned operating scenarios", () => {
    (Object.keys(HOME_COMPOSITIONS) as HomeMode[]).forEach((mode) => {
      const composition = getHomeComposition(mode);
      expect(composition.version).toBe("home.v1");
      expect(composition.mode).toBe(mode);
      expect(composition.blocks.map((block) => block.type)).toEqual(["health", "health", "health", ...expectedTypes.slice(1)]);
    });
  });

  it("keeps the stockout scenario explicit and blocks budget expansion", () => {
    const anomaly = getHomeComposition("ORDER_AD_ANOMALY");
    const brief = anomaly.blocks.find((block) => block.type === "brief");
    const actions = anomaly.blocks.find((block) => block.type === "actions");

    expect(brief?.type === "brief" && brief.status).toBe("NO_ORDERS");
    expect(actions?.type === "actions" && actions.items.some((item) => /暂停.*预算/.test(item.title))).toBe(true);
  });

  it("labels every demo block with source context in visible copy", () => {
    Object.values(HOME_COMPOSITIONS).forEach((composition) => {
      expect(composition.blocks.some((block) => block.type === "health" && block.value === "SIMULATED")).toBe(true);
      expect(composition.blocks.some((block) => block.type === "evidence" && block.rows.every((row) => row.source.startsWith("synthetic:") || row.source.startsWith("metric:")))).toBe(true);
    });
  });
});
