import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppShell from "../components/AppShell";
import { getHomeComposition, sendChatMessage } from "../lib/api";
import type { ChatResponse } from "../types/chat";
import { homeComposition } from "./fixtures/home";

vi.mock("../lib/api", () => ({
  getHomeComposition: vi.fn(),
  sendChatMessage: vi.fn(),
}));

const getHome = vi.mocked(getHomeComposition);
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
    sendChat.mockResolvedValue(chatResponse("50000000-0000-4000-8000-000000000001"));
  });

  afterEach(() => cleanup());

  it("shows an explicit API loading state", () => {
    getHome.mockReturnValue(new Promise(() => undefined));
    render(<AppShell />);

    expect(screen.getByText("Jarvis 正在组织今日经营结论")).toBeInTheDocument();
  });

  it("shows API failure without substituting fixture data", async () => {
    getHome.mockRejectedValue(new Error("offline"));
    render(<AppShell />);

    expect(await screen.findByText("Home API 不可用")).toBeInTheDocument();
    expect(screen.getByText(/未使用浏览器内置假数据回退/)).toBeInTheDocument();
  });

  it("renders API composition and persistent synthetic status", async () => {
    render(<AppShell />);

    expect(await screen.findByRole("heading", { name: "今日订单显著低于合格基线" })).toBeInTheDocument();
    expect(screen.getAllByText(/SYNTHETIC/).length).toBeGreaterThan(1);
    expect(screen.getByText("PROVISIONAL")).toBeInTheDocument();
  });

  it("submits chat and carries composition context into a follow-up", async () => {
    const user = userEvent.setup();
    render(<AppShell />);
    await screen.findByRole("heading", { name: "今日订单显著低于合格基线" });

    await user.click(screen.getByRole("button", { name: "今天为什么出单或没出单？" }));
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
    await user.click(screen.getAllByRole("button", { name: /我现在应该先改广告吗？/ })[0]);
    await screen.findByText("广告归因仍为 PROVISIONAL。");
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
    await screen.findByRole("heading", { name: "今日订单显著低于合格基线" });

    fireEvent.change(screen.getByLabelText("向运营助手提问"), {
      target: { value: "今天先做什么？" },
    });
    fireEvent.submit(screen.getByLabelText("向运营助手提问").closest("form")!);

    await waitFor(() => expect(sendChat).toHaveBeenCalledOnce());
  });
});
