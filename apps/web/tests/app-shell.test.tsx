import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppShell from "../components/AppShell";
import { getHomeComposition, getHomeVisualizations, sendChatMessage } from "../lib/api";
import type { ChatResponse } from "../types/chat";
import { homeComposition } from "./fixtures/home";
import { homeVisualizations } from "./fixtures/visualizations";

vi.mock("../lib/api", () => ({
  getHomeComposition: vi.fn(),
  getHomeVisualizations: vi.fn(),
  sendChatMessage: vi.fn(),
}));

const getHome = vi.mocked(getHomeComposition);
const getVisualizations = vi.mocked(getHomeVisualizations);
const sendChat = vi.mocked(sendChatMessage);

function chatResponse(runId: string, answer = "订单下降来自流量和转化同时走弱。"):
  ChatResponse {
  return {
    answer,
    findings: [{
      finding_id: "40000000-0000-4000-8000-000000000001",
      agent_id: "store_operations",
      finding_type: "ORDER_CHANGE",
      claim: "Orders changed -55.00%.",
      evidence_refs: [{ kind: "TOOL_OUTPUT", reference_id: "tool:compare_periods:test" }],
      data_period: { start: "2026-08-31T07:00:00Z", end: "2026-09-01T07:00:00Z" },
      source: ["synthetic:test-sp-api"],
      updated_at: "2026-08-31T12:00:00Z",
      confidence: 0.95,
      causal_status: "OBSERVED",
      limitations: [],
      alternative_hypotheses: [],
      recommended_next_step: "Inspect conversion blockers.",
      synthetic: true,
    }],
    evidence_refs: [{ kind: "TOOL_OUTPUT", reference_id: "tool:compare_periods:test" }],
    suggested_followups: ["我现在应该先改广告吗？"],
    context_snapshot: {
      business_date: "2026-08-31",
      marketplace: "ATVPDKIKX0DER",
      previous_ai_run_id: runId,
    },
    ai_run_id: runId,
    synthetic: true,
  };
}

describe("AppShell runtime", () => {
  beforeEach(() => {
    window.localStorage.clear();
    getHome.mockResolvedValue(homeComposition());
    getVisualizations.mockResolvedValue(homeVisualizations());
    sendChat.mockResolvedValue(chatResponse("50000000-0000-4000-8000-000000000001"));
  });

  afterEach(() => cleanup());

  it("shows an explicit API loading state", () => {
    getHome.mockReturnValue(new Promise(() => undefined));
    render(<AppShell />);

    expect(screen.getByText("正在整理今日经营判断")).toBeInTheDocument();
  });

  it("shows API failure without substituting fixture data", async () => {
    getHome.mockRejectedValue(new Error("offline"));
    render(<AppShell />);

    expect(await screen.findByText("Home API 不可用")).toBeInTheDocument();
    expect(screen.getByText(/未使用浏览器内置假数据回退/)).toBeInTheDocument();
  });

  it("shows an explicit empty state for a valid composition with no usable content", async () => {
    getHome.mockResolvedValue(homeComposition({ blocks: [], top_actions: [] }));
    render(<AppShell />);

    expect(await screen.findByText("当前没有可展示内容")).toBeInTheDocument();
    expect(screen.getByText(/没有可用的指标、行动或经营域信号/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "订单、流量与转化率同时下降。" })).not.toBeInTheDocument();
  });

  it("renders the localized executive composition in the default warm-light theme", async () => {
    render(<AppShell />);

    expect(await screen.findByRole("heading", { name: "订单、流量与转化率同时下降。" })).toBeInTheDocument();
    const summary = screen.getByLabelText("今日经营摘要");
    expect(summary).toHaveTextContent("订单");
    expect(summary).toHaveTextContent("流量");
    expect(summary).toHaveTextContent("CVR");
    expect(summary).toHaveTextContent("ACOS");
    expect(screen.getByText(/数据尚在归因/)).toBeInTheDocument();
    expect(screen.getByText("Demo data")).toBeInTheDocument();
    expect(screen.getAllByText(/模拟数据/).length).toBeGreaterThan(1);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("light"));
    expect(JSON.parse(window.localStorage.getItem("amazon-ai-os:workspace-preferences:v1.7") ?? "{}"))
      .toEqual(expect.objectContaining({ theme: "light" }));
  });

  it("submits chat and carries composition context into a follow-up", async () => {
    const user = userEvent.setup();
    render(<AppShell />);
    await screen.findByRole("heading", { name: "订单、流量与转化率同时下降。" });

    await user.click(screen.getByRole("button", { name: "为什么广告成本上涨？" }));
    expect(await screen.findByText("订单下降来自流量和转化同时走弱。")).toBeInTheDocument();
    expect(sendChat).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        business_date: "2026-08-31",
        marketplace: "ATVPDKIKX0DER",
        context: expect.objectContaining({
          home_composition_id: "20000000-0000-4000-8000-000000000001",
          previous_ai_run_id: undefined,
        }),
      }),
    );

    sendChat.mockResolvedValueOnce(
      chatResponse("50000000-0000-4000-8000-000000000002", "广告归因仍为 PROVISIONAL。"),
    );
    await user.click(screen.getByRole("button", { name: "会话" }));
    await user.click(screen.getByRole("button", { name: "我现在应该先改广告吗？" }));
    expect(await screen.findAllByText("广告归因仍为 PROVISIONAL。")).toHaveLength(2);
    expect(sendChat).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        context: expect.objectContaining({
          previous_ai_run_id: "50000000-0000-4000-8000-000000000001",
        }),
      }),
    );
  });

  it("submits a typed question from the persistent composer", async () => {
    render(<AppShell />);
    await screen.findByRole("heading", { name: "订单、流量与转化率同时下降。" });

    fireEvent.change(screen.getByLabelText("向运营助手提问"), {
      target: { value: "今天先做什么？" },
    });
    fireEvent.submit(screen.getByLabelText("向运营助手提问").closest("form")!);

    await waitFor(() => expect(sendChat).toHaveBeenCalledOnce());
  });
});
