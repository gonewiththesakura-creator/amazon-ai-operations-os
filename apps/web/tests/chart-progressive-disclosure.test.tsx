import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppShell from "../components/AppShell";
import { getHomeComposition, getHomeVisualizations, sendChatMessage } from "../lib/api";
import { homeComposition } from "./fixtures/home";
import { homeVisualizations } from "./fixtures/visualizations";

vi.mock("../lib/api", () => ({ getHomeComposition: vi.fn(), getHomeVisualizations: vi.fn(), sendChatMessage: vi.fn() }));

describe("M1.8 chart progressive disclosure", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(getHomeComposition).mockResolvedValue(homeComposition());
    vi.mocked(getHomeVisualizations).mockResolvedValue(homeVisualizations());
    vi.mocked(sendChatMessage).mockRejectedValue(new Error("not used"));
  });
  afterEach(() => cleanup());

  it("mounts heavy analytics only for expanded domains and keeps collapsed summaries to two metrics", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    await waitFor(() => expect(screen.getByTestId("domain-analytics-SALES_CONVERSION")).toBeInTheDocument());
    expect(screen.queryByTestId("domain-analytics-ADVERTISING")).not.toBeInTheDocument();

    const advertising = screen.getByRole("button", { name: /广告，需要关注，展开/ });
    const metrics = advertising.querySelector(".domain-metrics");
    expect(metrics?.children).toHaveLength(2);

    await user.click(advertising);
    await waitFor(() => expect(screen.getByTestId("domain-analytics-ADVERTISING")).toBeInTheDocument());
    expect(screen.getByRole("img", { name: "ACOS · 30D，30 天趋势" })).toBeInTheDocument();

    await user.click(advertising);
    await waitFor(() => expect(screen.queryByTestId("domain-analytics-ADVERTISING")).not.toBeInTheDocument());
  });

  it("keeps the Home experience usable when the optional visualization API fails", async () => {
    vi.mocked(getHomeVisualizations).mockRejectedValue(new Error("visualization offline"));
    render(<AppShell />);

    expect(await screen.findByRole("heading", { name: "订单、流量与转化率同时下降。" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /30 天趋势/ })).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "查看依据：订单漏斗" })).toBeInTheDocument();
  });
});
