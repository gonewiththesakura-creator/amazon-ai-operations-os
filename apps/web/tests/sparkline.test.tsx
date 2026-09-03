import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Sparkline } from "../components/charts/Sparkline";
import type { SparklineVisualizationSpec } from "../types/visualization";

afterEach(() => cleanup());

describe("M1.8 sparkline", () => {
  it("renders the exact seven source points without axes", () => {
    const spec = sparklineSpec();
    const { container } = render(<Sparkline spec={spec} reducedMotion={false} tone="positive" />);

    expect(screen.getByRole("img", { name: /订单 7 日趋势，7 个数据点/ })).toBeInTheDocument();
    expect(container.querySelector("polyline")?.getAttribute("points")?.split(" ")).toHaveLength(7);
    expect(container.querySelectorAll("text")).toHaveLength(0);
    expect(container.querySelector("svg")).toHaveClass("sparkline-reveal", "sparkline-positive");
  });

  it("removes the reveal class when reduced motion is enabled", () => {
    const { container } = render(<Sparkline spec={sparklineSpec()} reducedMotion />);
    expect(container.querySelector("svg")).not.toHaveClass("sparkline-reveal");
  });
});

function sparklineSpec(): SparklineVisualizationSpec {
  return {
    type: "SPARKLINE",
    title: "订单 7 日趋势",
    data_source: "synthetic:test-sp-api",
    period: "2026-08-25 – 2026-08-31",
    synthetic: true,
    window: 7,
    series: {
      metric: "orders",
      unit: "count",
      points: [31, 35, 34, 39, 38, 42, 45].map((value, index) => ({ period: `2026-08-${25 + index}`, value })),
    },
  };
}
