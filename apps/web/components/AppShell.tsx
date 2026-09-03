"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  CircleGauge,
  LoaderCircle,
  Menu,
  PanelRight,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { getHomeComposition, getHomeVisualizations, sendChatMessage } from "../lib/api";
import type { ChatContext } from "../types/chat";
import type { ActionSummary, HomeBlock, HomeComposition } from "../types/home";
import type { VisualizationSpec } from "../types/visualization";
import { buildHomeViewModel, hasUsableHomeContent } from "../view-models/home";
import type { OperatingDomainId } from "../view-models/operating-domains";
import { buildCompositionVisualizationSpecs, buildHomeVisualizationSpecs, buildMetricSparklineSpec } from "../view-models/visualizations";
import { Sparkline } from "./charts/Sparkline";
import { OperatingDomains } from "./OperatingDomains";
import { ConversationDrawer, HelpDrawer, SettingsDrawer, type ConversationMessage, type WorkspacePreferences } from "./WorkspaceDrawers";
import { Inspector, type InspectorMode } from "./Inspector";
import { WorkspaceNavigation } from "./WorkspaceNavigation";

const defaultPreferences: WorkspacePreferences = {
  density: "comfortable",
  displayTimezone: "America/Los_Angeles",
  reducedMotion: false,
  theme: "light",
};

type LoadState = "loading" | "success" | "empty" | "error";
type OpenDrawer = "settings" | "help" | "conversation" | null;

export default function AppShell() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLInputElement>(null);
  const inspectorOpenerRef = useRef<HTMLElement | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorMode, setInspectorMode] = useState<InspectorMode>("context");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [selectedVisualization, setSelectedVisualization] = useState<VisualizationSpec | null>(null);
  const [openDrawer, setOpenDrawer] = useState<OpenDrawer>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [input, setInput] = useState("");
  const [composition, setComposition] = useState<HomeComposition | null>(null);
  const [visualizations, setVisualizations] = useState<VisualizationSpec[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [expandedDomainIds, setExpandedDomainIds] = useState<OperatingDomainId[]>([]);
  const [chatting, setChatting] = useState(false);
  const [preferences, setPreferences] = useState<WorkspacePreferences>(defaultPreferences);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  const loadHome = useCallback(async (signal?: AbortSignal, refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoadState("loading");
    try {
      const result = await getHomeComposition(signal);
      setComposition(result);
      setLoadState(hasUsableHomeContent(result) ? "success" : "empty");
      setSelectedBlockId((current) => current ?? result.blocks[0]?.block_id ?? null);
      setSelectedActionId((current) => current ?? result.top_actions[0]?.action_id ?? null);
      const compositionVisualizations = buildCompositionVisualizationSpecs(result);
      setVisualizations(compositionVisualizations);
      void getHomeVisualizations(signal)
        .then((response) => setVisualizations([...compositionVisualizations, ...buildHomeVisualizationSpecs(response)]))
        .catch((error) => {
          if (!(error instanceof DOMException && error.name === "AbortError")) setVisualizations(compositionVisualizations);
        });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadState("error");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadHome(controller.signal);
    return () => controller.abort();
  }, [loadHome]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("amazon-ai-os:workspace-preferences:v1.7");
      if (stored) setPreferences({ ...defaultPreferences, ...JSON.parse(stored) as Partial<WorkspacePreferences> });
    } catch {
      window.localStorage.removeItem("amazon-ai-os:workspace-preferences:v1.7");
    } finally {
      setPreferencesLoaded(true);
    }
    if (window.matchMedia("(max-width: 1119px)").matches) setInspectorOpen(false);
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) return;
    window.localStorage.setItem("amazon-ai-os:workspace-preferences:v1.7", JSON.stringify(preferences));
    document.documentElement.dataset.density = preferences.density;
    document.documentElement.dataset.motion = preferences.reducedMotion ? "reduced" : "full";
    document.documentElement.dataset.theme = preferences.theme;
  }, [preferences, preferencesLoaded]);

  useEffect(() => {
    function handleKeyboard(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const editing = target?.matches("input, textarea, select, [contenteditable='true']");
      if (event.key === "/" && !editing) {
        event.preventDefault();
        composerRef.current?.focus();
      }
      if (event.key === "Escape") {
        setAccountOpen(false);
        setOpenDrawer(null);
        setMobileNav(false);
        closeInspector();
      }
    }
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, []);

  const context = useMemo<ChatContext | null>(() => composition ? {
    business_date: composition.business_date,
    marketplace: composition.marketplace,
    selected_asin: null,
    selected_campaign: null,
    home_composition_id: composition.composition_id,
    previous_ai_run_id: [...messages].reverse().find((message) => message.response)?.response?.ai_run_id,
  } : null, [composition, messages]);

  const selectedBlock = useMemo(
    () => composition?.blocks.find((block) => block.block_id === selectedBlockId) ?? null,
    [composition, selectedBlockId],
  );
  const selectedAction = useMemo(
    () => composition?.top_actions.find((action) => action.action_id === selectedActionId) ?? null,
    [composition, selectedActionId],
  );
  const userQuestions = messages.filter((message) => message.role === "user").map((message) => message.content);
  const homeView = useMemo(() => composition ? buildHomeViewModel(composition) : null, [composition]);
  const latestAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant") ?? null;

  useEffect(() => {
    if (!homeView) return;
    setExpandedDomainIds(homeView.domains.filter((domain) => domain.defaultExpanded).map((domain) => domain.id));
  }, [composition?.composition_id, composition?.generated_at, homeView]);

  async function submitQuestion(question: string) {
    const normalized = question.trim();
    if (!normalized || !composition || !context || chatting) return;
    const userMessage: ConversationMessage = { id: crypto.randomUUID(), role: "user", content: normalized };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setChatting(true);
    try {
      const response = await sendChatMessage({
        message: normalized,
        marketplace: composition.marketplace,
        business_date: composition.business_date,
        context,
      });
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: response.answer, response }]);
    } catch {
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Jarvis 暂时无法完成分析。数据没有被修改，请检查 API 连接后重试。",
      }]);
    } finally {
      setChatting(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitQuestion(input);
  }

  function openEvidence(block: HomeBlock) {
    rememberInspectorOpener();
    setSelectedVisualization(null);
    setSelectedBlockId(block.block_id);
    setInspectorMode("evidence");
    setInspectorOpen(true);
  }

  function openVisualizationEvidence(visualization: VisualizationSpec) {
    rememberInspectorOpener();
    setSelectedVisualization(visualization);
    setInspectorMode("evidence");
    setInspectorOpen(true);
  }

  function openAction(action: ActionSummary, block?: HomeBlock | null) {
    rememberInspectorOpener();
    setSelectedVisualization(null);
    const relatedBlock = block ?? findActionEvidenceBlock(action, composition?.blocks ?? []);
    setSelectedActionId(action.action_id);
    setSelectedBlockId(relatedBlock?.block_id ?? null);
    setInspectorMode("action");
    setInspectorOpen(true);
  }

  function openActionForBlock(block: HomeBlock) {
    const action = findBlockAction(block, composition?.top_actions ?? []);
    if (action) openAction(action, block);
  }

  function rememberInspectorOpener() {
    if (document.activeElement instanceof HTMLElement && !document.activeElement.closest(".inspector")) {
      inspectorOpenerRef.current = document.activeElement;
    }
  }

  function closeInspector() {
    setInspectorOpen(false);
    window.requestAnimationFrame(() => inspectorOpenerRef.current?.focus());
  }

  function toggleInspector() {
    if (inspectorOpen) {
      closeInspector();
      return;
    }
    rememberInspectorOpener();
    setInspectorOpen(true);
  }

  function showHome() {
    setMobileNav(false);
    const canvas = canvasRef.current;
    if (canvas && typeof canvas.scrollTo === "function") canvas.scrollTo({ top: 0, behavior: preferences.reducedMotion ? "auto" : "smooth" });
  }

  function toggleDomain(domainId: OperatingDomainId) {
    setExpandedDomainIds((current) => {
      if (current.includes(domainId)) return current.filter((id) => id !== domainId);
      if (current.length < 2) return [...current, domainId];
      return [current[1], domainId];
    });
  }

  const formattedGeneratedAt = composition
    ? new Intl.DateTimeFormat("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: preferences.displayTimezone === "BROWSER_LOCAL" ? undefined : preferences.displayTimezone,
      }).format(new Date(composition.generated_at))
    : "—";

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="icon-control mobile-menu" type="button" aria-label="打开导航" onClick={() => setMobileNav(true)}><Menu size={19} /></button>
        <button className="brand" type="button" onClick={showHome} aria-label="返回今日运营顶部">
          <span>OPS</span>
        </button>
        <div className="topbar-spacer" />
        <span className="demo-label">Demo data</span>
        <div className="account-control">
          <button className="avatar-button" type="button" aria-label="打开账户菜单" aria-expanded={accountOpen} onClick={() => setAccountOpen((current) => !current)}>JT</button>
          {accountOpen && (
            <div className="account-menu" role="menu">
              <div><strong>JT</strong><span>店主 · 演示工作区</span></div>
              <div className="account-facts"><span>Atlas Home Goods</span><span>美国站</span><span>只读</span></div>
              <button type="button" role="menuitem" onClick={() => { setAccountOpen(false); setOpenDrawer("settings"); }}><Settings2 size={15} /> 工作区设置</button>
              <button type="button" role="menuitem" onClick={() => { setAccountOpen(false); setOpenDrawer("help"); }}><ShieldCheck size={15} /> 帮助与边界</button>
            </div>
          )}
        </div>
      </header>

      <div className={`workspace ${inspectorOpen ? "inspector-is-open" : ""}`}>
        <WorkspaceNavigation
          mobileOpen={mobileNav}
          userQuestions={userQuestions}
          onClose={() => setMobileNav(false)}
          onHome={showHome}
          onOpenConversation={() => { setMobileNav(false); setOpenDrawer("conversation"); }}
          onOpenSettings={() => setOpenDrawer("settings")}
          onOpenHelp={() => setOpenDrawer("help")}
        />
        {mobileNav && <button className="nav-scrim" type="button" aria-label="关闭导航" onClick={() => setMobileNav(false)} />}

        <main className="main-column">
          <div className="main-toolbar">
            <div className="toolbar-location">
              <CircleGauge size={15} />
              <span>今日运营</span>
              <strong>{composition ? stateLabel(composition.home_state) : "连接中"}</strong>
            </div>
            <div className="toolbar-actions">
              <span className="generated-time">{formattedGeneratedAt}</span>
              <button className="text-control" type="button" disabled={refreshing} onClick={() => void loadHome(undefined, true)}>
                <RefreshCw size={15} className={refreshing ? "spin" : ""} />
                <span>{refreshing ? "同步中" : "刷新"}</span>
              </button>
              <button className="icon-control" type="button" aria-label={inspectorOpen ? "收起检查器" : "打开检查器"} onClick={toggleInspector}>
                <PanelRight size={18} />
              </button>
            </div>
          </div>

          <div className="canvas-scroll" ref={canvasRef}>
            {loadState === "loading" && <JarvisLoading />}
            {loadState === "error" && (
              <RuntimeState title="Home API 不可用" body="未使用浏览器内置假数据回退。请启动 FastAPI 与 PostgreSQL 后重试。" action={() => void loadHome()} />
            )}
            {loadState === "empty" && (
              <RuntimeState title="当前没有可展示内容" body="API 返回了有效 HomeComposition，但没有可用的指标、行动或经营域信号。" action={() => void loadHome()} />
            )}
            {composition && homeView && loadState === "success" && (
              <>
                <section className="jarvis-brief" aria-labelledby="daily-judgment">
                  <p className="business-date">{formatBusinessDate(homeView.businessDate)} · {homeView.marketplaceLabel}</p>
                  <h1 id="daily-judgment" key={composition.composition_id}>{humanizeNarrative(homeView.judgment)}</h1>
                  <p className="judgment-reason">{humanizeNarrative(homeView.explanation)}</p>
                  <p className="brief-metadata">{homeView.metadata}</p>
                </section>

                {homeView.metrics.length > 0 && (
                  <section className="metric-strip" aria-label="今日经营摘要">
                    {homeView.metrics.map((metric) => (
                      <div className="metric-strip-item" key={metric.label}>
                        <span>{metric.label}</span>
                        <div className="metric-value-row">
                          <strong>{metric.value}</strong>
                          {buildMetricSparklineSpec(metric.label, visualizations) && (
                            <Sparkline
                              spec={buildMetricSparklineSpec(metric.label, visualizations)!}
                              reducedMotion={preferences.reducedMotion}
                              tone={metric.tone}
                            />
                          )}
                        </div>
                        {metric.note && <small className={metric.tone ? `tone-${metric.tone}` : ""}>{metric.note}</small>}
                      </div>
                    ))}
                  </section>
                )}

                <section className="priority-section" aria-labelledby="priority-heading">
                  <div className="section-heading-row">
                    <div><h2 id="priority-heading">今天先做什么</h2><p>Jarvis 已按经营影响和证据确定性排序。</p></div>
                    {homeView.hasMoreActions && <button type="button" className="section-link" onClick={() => { rememberInspectorOpener(); setInspectorMode("approval"); setInspectorOpen(true); }}>查看全部建议 <ArrowUpRight size={14} /></button>}
                  </div>
                  <ol className="priority-list">
                    {homeView.actions.map((action) => (
                      <li key={action.action_id}>
                        <button type="button" onClick={() => openAction(action)}>
                          <span className="priority-rank">{String(action.priority).padStart(2, "0")}</span>
                          <span><strong>{humanizeNarrative(action.title)}</strong><small>{actionListReason(action)}</small></span>
                          <span className="priority-state">查看原因 <ArrowUpRight size={14} /></span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </section>

                <OperatingDomains
                  domains={homeView.domains}
                  expandedIds={expandedDomainIds}
                  reducedMotion={preferences.reducedMotion}
                  visualizations={visualizations}
                  onToggle={toggleDomain}
                  onOpenEvidence={openEvidence}
                  onOpenVisualizationEvidence={openVisualizationEvidence}
                  onOpenAction={openActionForBlock}
                  onSubmitFollowUp={(question) => void submitQuestion(question)}
                />

                <section className="quick-prompts" aria-label="快捷问题">
                  <span>继续问 Jarvis</span>
                  <div>{homeView.quickQuestions.map((question) => <button type="button" key={question} onClick={() => void submitQuestion(question)}>{question}</button>)}</div>
                </section>

                {(latestAssistantMessage || chatting) && (
                  <aside className="latest-response" aria-live="polite" aria-label="Jarvis 最新回答">
                    <div><span>JARVIS</span><strong>{chatting ? "正在继续分析" : "最新回答"}</strong></div>
                    {chatting ? <JarvisThinking /> : <p>{latestAssistantMessage?.content}</p>}
                    <button type="button" onClick={() => setOpenDrawer("conversation")}>查看完整会话 <ArrowUpRight size={14} /></button>
                  </aside>
                )}
              </>
            )}
            <div className="canvas-bottom-space" />
          </div>

          <div className="composer-dock">
            <form className="composer" onSubmit={onSubmit}>
              <Sparkles size={17} className="composer-icon" />
              <input
                ref={composerRef}
                aria-label="向运营助手提问"
                placeholder="追问经营原因、证据或下一步…"
                value={input}
                disabled={!composition || chatting}
                onChange={(event) => setInput(event.target.value)}
              />
              <span className="composer-shortcut" aria-hidden="true">/</span>
              <button className="send-button" type="submit" aria-label="发送问题" disabled={!input.trim() || !composition || chatting}><Send size={16} /></button>
            </form>
            <div className="composer-context">
              <span>美国站</span><span>{composition?.business_date ?? "等待数据"}</span><span>全部 ASIN</span><span>SP 广告</span>
              <strong><ShieldCheck size={12} /> 只读 · 模拟数据</strong>
            </div>
          </div>
        </main>

        <Inspector
          action={selectedAction}
          block={selectedBlock}
          composition={composition}
          mode={inspectorMode}
          open={inspectorOpen}
          visualization={selectedVisualization}
          onClose={closeInspector}
          onModeChange={setInspectorMode}
          onSelectAction={(action) => openAction(action)}
          onSelectEvidence={openEvidence}
        />
      </div>

      <SettingsDrawer open={openDrawer === "settings"} onClose={() => setOpenDrawer(null)} preferences={preferences} onChange={setPreferences} />
      <HelpDrawer open={openDrawer === "help"} onClose={() => setOpenDrawer(null)} />
      <ConversationDrawer open={openDrawer === "conversation"} onClose={() => setOpenDrawer(null)} messages={messages} onSubmitFollowUp={(question) => void submitQuestion(question)} />
    </div>
  );
}

function evidenceKey(reference: { kind: string; reference_id: string }) {
  return `${reference.kind}:${reference.reference_id}`;
}

function sharedEvidenceCount(
  left: Array<{ kind: string; reference_id: string }>,
  right: Array<{ kind: string; reference_id: string }>,
) {
  const rightKeys = new Set(right.map(evidenceKey));
  return left.reduce((total, reference) => total + Number(rightKeys.has(evidenceKey(reference))), 0);
}

function findActionEvidenceBlock(action: ActionSummary, blocks: HomeBlock[]) {
  const candidates = blocks
    .map((block) => ({
      block,
      shared: sharedEvidenceCount(action.evidence_refs, block.evidence_refs),
      exact: block.evidence_refs.length === action.evidence_refs.length
        && sharedEvidenceCount(action.evidence_refs, block.evidence_refs) === action.evidence_refs.length,
    }))
    .filter((candidate) => candidate.shared > 0)
    .sort((left, right) => Number(right.exact) - Number(left.exact)
      || right.shared - left.shared
      || left.block.priority - right.block.priority);
  return candidates[0]?.block ?? null;
}

function findBlockAction(block: HomeBlock, actions: ActionSummary[]) {
  return [...actions]
    .map((action) => ({ action, shared: sharedEvidenceCount(action.evidence_refs, block.evidence_refs) }))
    .filter((candidate) => candidate.shared > 0)
    .sort((left, right) => right.shared - left.shared || left.action.priority - right.action.priority)[0]?.action ?? null;
}

function JarvisLoading() {
  return (
    <div className="runtime-state jarvis-loading" aria-live="polite">
      <LoaderCircle size={22} />
      <h2>正在整理今日经营判断</h2>
      <ul>
        <li><span />读取已验证的店铺日指标</li>
        <li><span />比较合格基线与归因成熟度</li>
        <li><span />组合行动、证据与限制</li>
      </ul>
    </div>
  );
}

function JarvisThinking() {
  return (
    <article className="chat-message chat-assistant jarvis-thinking" aria-label="Jarvis 正在分析">
      <span className="message-role">Jarvis</span>
      <div className="message-body"><p>正在调用 Store Operations Agent 与确定性工具</p><span className="thinking-line"><i /><i /><i /></span></div>
    </article>
  );
}

function RuntimeState({ title, body, action }: { title: string; body: string; action?: () => void }) {
  return (
    <div className="runtime-state">
      <CircleGauge size={22} />
      <h2>{title}</h2>
      <p>{body}</p>
      {action && <button className="secondary-command" type="button" onClick={action}>重新连接</button>}
    </div>
  );
}

function stateLabel(value: HomeComposition["home_state"]) {
  return ({
    NORMAL: "经营稳定",
    ORDER_AD_ANOMALY: "订单 / 广告异常",
    INVENTORY_PROFIT_RISK: "库存 / 利润风险",
    MARKET_POLICY_CHANGE: "市场 / 政策变化",
    DATA_INCOMPLETE: "数据不完整",
  } as const)[value];
}

function formatBusinessDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function humanizeNarrative(value: string) {
  return value
    .replaceAll("Sponsored Products", "广告")
    .replaceAll("Sessions", "流量")
    .replaceAll("CVR", "转化率")
    .replaceAll("PROVISIONAL", "归因尚未成熟")
    .replaceAll("订单、流量 与 转化率 同时下降", "订单、流量与转化率同时下降")
    .replaceAll("转化率 同时下降", "转化率同时下降");
}

function actionListReason(action: ActionSummary) {
  if (action.action_type.includes("ATTRIBUTION")) return "当前归因尚未成熟，避免过早根据 ACOS 调整。";
  if (action.action_type.includes("AD")) return "搜索词与预算需要复核，但不会执行任何修改。";
  if (action.action_type.includes("CONVERSION")) return "先排除可售、价格与详情页对转化的阻断。";
  return "仅生成建议，等待人工审阅。";
}
