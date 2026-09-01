import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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

const chatResponse: ChatResponse = {
  answer: "订单下降来自流量和转化同时走弱。",
  findings: [],
  evidence_refs: [{ kind: "TOOL_OUTPUT", reference_id: "tool:test" }],
  suggested_followups: ["我现在应该先改广告吗？"],
  context_snapshot: { business_date: "2026-08-31", marketplace: "ATVPDKIKX0DER" },
  ai_run_id: "50000000-0000-4000-8000-000000000001",
  synthetic: true,
};

describe("M1.5 interaction contract", () => {
  beforeEach(() => {
    window.localStorage.clear();
    getHome.mockResolvedValue(homeComposition());
    sendChat.mockResolvedValue(chatResponse);
  });

  afterEach(() => cleanup());

  it("marks future destinations and notifications as unavailable with reasons", async () => {
    render(<AppShell />);
    await screen.findByRole("heading", { name: "订单、Sessions 与 CVR 同时下降。" });

    expect(screen.getByRole("button", { name: "ASIN 经营，M2 开放" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "ASIN 经营，M2 开放" })).toHaveAttribute("title", "ASIN 经营 将在 M2 开放");
    expect(screen.getByRole("button", { name: "通知，M2 开放" })).toBeDisabled();
    expect(within(screen.getByTestId("store-context")).queryByRole("button")).not.toBeInTheDocument();
  });

  it("opens the account menu and functional settings drawer", async () => {
    const user = userEvent.setup();
    render(<AppShell />);
    await screen.findByRole("heading", { name: "订单、Sessions 与 CVR 同时下降。" });

    await user.click(screen.getByRole("button", { name: "打开账户菜单" }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("Owner · Demo tenant")).toBeInTheDocument();
    await user.click(within(menu).getByRole("menuitem", { name: "工作区设置" }));
    expect(screen.getByRole("dialog", { name: "工作区设置" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "紧凑" }));
    await waitFor(() => expect(document.documentElement.dataset.density).toBe("compact"));
  });

  it("opens truthful help and closes it", async () => {
    const user = userEvent.setup();
    render(<AppShell />);
    await screen.findByRole("heading", { name: "订单、Sessions 与 CVR 同时下降。" });

    await user.click(screen.getByRole("button", { name: "帮助与边界" }));
    expect(screen.getByRole("dialog", { name: "帮助与运行边界" })).toHaveTextContent("当前系统只读");
    await user.click(within(screen.getByRole("dialog", { name: "帮助与运行边界" })).getByRole("button", { name: "关闭帮助与运行边界" }));
    expect(screen.queryByRole("dialog", { name: "帮助与运行边界" })).not.toBeInTheDocument();
  });

  it("refreshes the HomeComposition through the API", async () => {
    const user = userEvent.setup();
    render(<AppShell />);
    await screen.findByRole("heading", { name: "订单、Sessions 与 CVR 同时下降。" });
    await user.click(screen.getByRole("button", { name: "刷新" }));
    await waitFor(() => expect(getHome).toHaveBeenCalledTimes(2));
  });

  it("opens evidence, action, and approval inspector modes", async () => {
    const user = userEvent.setup();
    render(<AppShell />);
    await screen.findByRole("heading", { name: "订单、Sessions 与 CVR 同时下降。" });

    await user.click(screen.getAllByRole("button", { name: /检查证据/ })[0]);
    expect(screen.getByRole("tab", { name: /证据/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("正在检查的结论")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /检查转化阻断/ }));
    expect(screen.getByText("DRAFT · REVIEW ONLY")).toBeInTheDocument();
    expect(screen.getByText("NO AMAZON WRITE ACCESS")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "查看全部草案" }));
    expect(screen.getByRole("tab", { name: /草案/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("待审阅草案")).toHaveTextContent("M1.5 不提供批准或 Amazon 执行控件");
  });

  it("binds every action draft to matching evidence instead of a stale block", async () => {
    const user = userEvent.setup();
    render(<AppShell />);
    await screen.findByRole("heading", { name: "订单、Sessions 与 CVR 同时下降。" });

    await user.click(screen.getAllByRole("button", { name: /检查证据/ })[0]);
    await user.click(screen.getByRole("button", { name: /复核 SP 搜索词与预算/ }));
    let inspector = screen.getByLabelText("上下文与证据检查器");
    expect(within(inspector).getByText("广告归因尚未成熟。")).toBeInTheDocument();
    expect(within(inspector).getByText("78%")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /等待归因成熟后复查 ACOS/ }));
    inspector = screen.getByLabelText("上下文与证据检查器");
    expect(within(inspector).getByText("广告归因尚未成熟。")).toBeInTheDocument();
    expect(within(inspector).getByText("78%")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "审阅行动草案" }));
    inspector = screen.getByLabelText("上下文与证据检查器");
    expect(within(inspector).getByText("CVR 降幅大于 Sessions 降幅。")).toBeInTheDocument();
    expect(within(inspector).getByText("90%")).toBeInTheDocument();
  });

  it("closes the inspector with Escape, removes it from the tab order, and restores focus", async () => {
    const user = userEvent.setup();
    render(<AppShell />);
    await screen.findByRole("heading", { name: "订单、Sessions 与 CVR 同时下降。" });

    const evidenceButton = screen.getAllByRole("button", { name: /检查证据/ })[0];
    await user.click(evidenceButton);
    const inspector = screen.getByLabelText("上下文与证据检查器");
    expect(inspector).not.toHaveAttribute("inert");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(inspector).toHaveAttribute("inert"));
    await waitFor(() => expect(evidenceButton).toHaveFocus());
  });

  it("submits quick, typed, and registered follow-up questions", async () => {
    const user = userEvent.setup();
    render(<AppShell />);
    await screen.findByRole("heading", { name: "订单、Sessions 与 CVR 同时下降。" });

    await user.click(screen.getByRole("button", { name: "今天为什么出单或没出单？" }));
    await waitFor(() => expect(sendChat).toHaveBeenCalledTimes(1));

    const input = screen.getByLabelText("向运营助手提问");
    await user.type(input, "库存风险是什么？");
    await user.click(screen.getByRole("button", { name: "发送问题" }));
    await waitFor(() => expect(sendChat).toHaveBeenCalledTimes(2));

    await user.click(screen.getByRole("button", { name: /我现在应该先改广告吗？直接追问/ }));
    await waitFor(() => expect(sendChat).toHaveBeenCalledTimes(3));
  });

  it("focuses the persistent composer with the slash shortcut", async () => {
    const user = userEvent.setup();
    render(<AppShell />);
    await screen.findByRole("heading", { name: "订单、Sessions 与 CVR 同时下降。" });
    await user.keyboard("/");
    expect(screen.getByLabelText("向运营助手提问")).toHaveFocus();
  });
});
