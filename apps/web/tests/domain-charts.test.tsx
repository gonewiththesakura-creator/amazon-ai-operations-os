import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DomainAnalytics } from "../components/charts/DomainAnalytics";
import { buildOperatingDomains } from "../view-models/operating-domains";
import { buildHomeVisualizationSpecs } from "../view-models/visualizations";
import { homeComposition } from "./fixtures/home";
import { homeVisualizations } from "./fixtures/visualizations";

afterEach(() => cleanup());

describe("M1.8 domain charts", () => {
  it("shows one selected primary chart, one secondary chart, and a bounded Jarvis insight", async () => {
    const user = userEvent.setup();
    const domain = buildOperatingDomains(homeComposition()).find((item) => item.id === "SALES_CONVERSION")!;
    render(
      <DomainAnalytics
        domain={domain}
        specs={buildHomeVisualizationSpecs(homeVisualizations())}
        reducedMotion={false}
        onOpenVisualizationEvidence={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.getByRole("img", { name: "订单 · 30D，30 天趋势" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /销售额构成，4 个部分/ })).toBeInTheDocument();
    expect(screen.getAllByText("Jarvis")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "销售额" }));
    expect(screen.getByRole("img", { name: "销售额 · 30D，30 天趋势" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "订单 · 30D，30 天趋势" })).not.toBeInTheDocument();
  });

  it("reveals a source-backed tooltip on keyboard focus", () => {
    const domain = buildOperatingDomains(homeComposition()).find((item) => item.id === "SALES_CONVERSION")!;
    render(
      <DomainAnalytics
        domain={domain}
        specs={buildHomeVisualizationSpecs(homeVisualizations())}
        reducedMotion
        onOpenVisualizationEvidence={vi.fn()}
      />,
    );

    fireEvent.focus(screen.getByLabelText(/8月2日/));
    expect(screen.getByRole("status")).toHaveTextContent("模拟数据");
  });
});
