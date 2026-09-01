import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppShell from "../components/AppShell";
import { getHomeComposition, sendChatMessage } from "../lib/api";
import type { ChatResponse } from "../types/chat";
import { homeComposition } from "./fixtures/home";

vi.mock("../lib/api", () => ({ getHomeComposition: vi.fn(), sendChatMessage: vi.fn() }));
const getHome = vi.mocked(getHomeComposition);
const sendChat = vi.mocked(sendChatMessage);

describe("M1.7 progressive disclosure", () => {
  beforeEach(() => {
    window.localStorage.clear();
    getHome.mockResolvedValue(homeComposition());
    sendChat.mockResolvedValue(response("第一条 Jarvis 回答"));
  });
  afterEach(() => cleanup());

  it("renders the executive reading order without duplicate block content", async () => {
    render(<AppShell />);
    await screen.findByRole("heading", { name: "订单、流量与转化率同时下降。" });
    const main = screen.getByRole("main");
    const today = screen.getByRole("heading", { name: "订单、流量与转化率同时下降。" }).closest("section")!;
    const metrics = screen.getByLabelText("今日经营摘要");
    const actions = screen.getByRole("heading", { name: "今天先做什么" }).closest("section")!;
    const domains = screen.getByRole("heading", { name: "经营状况" }).closest("section")!;

    expect(today.compareDocumentPosition(metrics) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(metrics.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(actions.compareDocumentPosition(domains) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(main).queryByText("先验证转化下降原因，再决定是否调整广告")).not.toBeInTheDocument();
    expect(within(main).queryByText("我现在应该先改广告吗？")).not.toBeInTheDocument();
    expect(within(main).queryByText("经营目标")).not.toBeInTheDocument();
    expect(within(main).queryByText("数据状态")).not.toBeInTheDocument();
  });

  it("keeps no more than two domains open and leaves no-data domains collapsed", async () => {
    const user = userEvent.setup();
    render(<AppShell />);
    await screen.findByRole("heading", { name: "经营状况" });
    const toggles = screen.getAllByRole("button", { name: /，(高优先级|需要关注|稳定|正向信号|暂无信号)，(展开|收起)/ });

    await waitFor(() => expect(toggles.filter((button) => button.getAttribute("aria-expanded") === "true")).toHaveLength(2));
    const listing = screen.getByRole("button", { name: /商品与 Listing，暂无信号，展开/ });
    await user.click(listing);
    expect(listing).toHaveAttribute("aria-expanded", "true");
    expect(toggles.filter((button) => button.getAttribute("aria-expanded") === "true").length).toBeLessThanOrEqual(2);
  });

  it("keeps raw evidence out of the reading flow and accessible in Inspector", async () => {
    const user = userEvent.setup();
    render(<AppShell />);
    const evidence = await screen.findByRole("button", { name: "查看依据：订单漏斗" });
    const main = screen.getByRole("main");
    expect(within(main).queryByText("synthetic:test-sp-api")).not.toBeInTheDocument();
    expect(within(main).queryByText("展开来源与口径")).not.toBeInTheDocument();

    await user.click(evidence);
    const inspector = screen.getByLabelText("上下文与证据检查器");
    expect(inspector).not.toHaveAttribute("inert");
    expect(screen.getByRole("tab", { name: /依据/ })).toHaveAttribute("aria-selected", "true");
    expect(within(inspector).getByText("synthetic:test-sp-api")).toBeInTheDocument();
  });

  it("shows only the latest response on home and moves full history into the conversation drawer", async () => {
    const user = userEvent.setup();
    render(<AppShell />);
    await screen.findByRole("heading", { name: "经营状况" });
    await user.click(screen.getByRole("button", { name: "为什么广告成本上涨？" }));
    await screen.findByText("第一条 Jarvis 回答");

    sendChat.mockResolvedValueOnce(response("第二条 Jarvis 回答"));
    fireEvent.change(screen.getByLabelText("向运营助手提问"), { target: { value: "继续分析" } });
    await user.click(screen.getByRole("button", { name: "发送问题" }));
    await screen.findByText("第二条 Jarvis 回答");
    expect(within(screen.getByRole("main")).queryByText("第一条 Jarvis 回答")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "当前对话" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /查看完整会话/ }));
    const drawer = screen.getByRole("dialog", { name: "当前会话" });
    expect(within(drawer).getByText("第一条 Jarvis 回答")).toBeInTheDocument();
    expect(within(drawer).getByText("第二条 Jarvis 回答")).toBeInTheDocument();
  });
});

function response(answer: string): ChatResponse {
  return {
    answer,
    findings: [],
    evidence_refs: [{ kind: "TOOL_OUTPUT", reference_id: "tool:test" }],
    suggested_followups: [],
    context_snapshot: { business_date: "2026-08-31", marketplace: "ATVPDKIKX0DER" },
    ai_run_id: crypto.randomUUID(),
    synthetic: true,
  };
}
