"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Bot,
  ChevronDown,
  CircleGauge,
  Menu,
  PanelRight,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { getHomeComposition, sendChatMessage } from "../lib/api";
import type { ChatContext, ChatResponse } from "../types/chat";
import type { ActionSummary, HomeBlock, HomeComposition } from "../types/home";
import { ComponentRegistry } from "./ComponentRegistry";
import { HelpDrawer, SettingsDrawer, type WorkspacePreferences } from "./WorkspaceDrawers";
import { Inspector, type InspectorMode } from "./Inspector";
import { WorkspaceNavigation } from "./WorkspaceNavigation";

const quickQuestions = [
  "今天为什么出单或没出单？",
  "今天先处理哪三件事？",
  "哪条广告浪费最严重？",
  "目前是否真正盈利？",
];

const defaultPreferences: WorkspacePreferences = {
  density: "comfortable",
  displayTimezone: "America/Los_Angeles",
  evidenceExpanded: false,
  reducedMotion: false,
  theme: "dark",
};

type LoadState = "loading" | "success" | "empty" | "error";
type Message = { id: string; role: "user" | "assistant"; content: string; response?: ChatResponse };
type OpenDrawer = "settings" | "help" | null;

export default function AppShell() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLInputElement>(null);
  const inspectorOpenerRef = useRef<HTMLElement | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [inspectorMode, setInspectorMode] = useState<InspectorMode>("context");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [openDrawer, setOpenDrawer] = useState<OpenDrawer>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [input, setInput] = useState("");
  const [composition, setComposition] = useState<HomeComposition | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatting, setChatting] = useState(false);
  const [preferences, setPreferences] = useState<WorkspacePreferences>(defaultPreferences);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  const loadHome = useCallback(async (signal?: AbortSignal, refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoadState("loading");
    try {
      const result = await getHomeComposition(signal);
      setComposition(result);
      setLoadState(result.blocks.length ? "success" : "empty");
      setSelectedBlockId((current) => current ?? result.blocks[0]?.block_id ?? null);
      setSelectedActionId((current) => current ?? result.top_actions[0]?.action_id ?? null);
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
      const stored = window.localStorage.getItem("amazon-ai-os:workspace-preferences");
      if (stored) setPreferences({ ...defaultPreferences, ...JSON.parse(stored) as Partial<WorkspacePreferences> });
    } catch {
      window.localStorage.removeItem("amazon-ai-os:workspace-preferences");
    } finally {
      setPreferencesLoaded(true);
    }
    if (window.matchMedia("(max-width: 1119px)").matches) setInspectorOpen(false);
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) return;
    window.localStorage.setItem("amazon-ai-os:workspace-preferences", JSON.stringify(preferences));
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

  async function submitQuestion(question: string) {
    const normalized = question.trim();
    if (!normalized || !composition || !context || chatting) return;
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: normalized };
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
    setSelectedBlockId(block.block_id);
    setInspectorMode("evidence");
    setInspectorOpen(true);
  }

  function openAction(action: ActionSummary, block?: HomeBlock | null) {
    rememberInspectorOpener();
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
          <span className="brand-mark"><Sparkles size={15} /></span>
          <span>AMAZON OPS <small>/ JARVIS</small></span>
        </button>
        <div className="topbar-spacer" />
        <span className="top-status synthetic-status"><span /> SYNTHETIC DATA</span>
        <span className="top-status ai-status">{composition?.data_status.ai_mode === "ENABLED" ? "AI ENABLED" : "DETERMINISTIC FALLBACK"}</span>
        <button className="icon-control" type="button" disabled title="通知将在 M2 开放" aria-label="通知，M2 开放"><Bell size={17} /></button>
        <div className="account-control">
          <button className="avatar-button" type="button" aria-label="打开账户菜单" aria-expanded={accountOpen} onClick={() => setAccountOpen((current) => !current)}>JT</button>
          {accountOpen && (
            <div className="account-menu" role="menu">
              <div><strong>JT</strong><span>Owner · Demo tenant</span></div>
              <div className="account-facts"><span>Atlas Home Goods</span><span>Amazon US</span><span>Read only</span></div>
              <button type="button" role="menuitem" onClick={() => { setAccountOpen(false); setOpenDrawer("settings"); }}><Settings2 size={15} /> 工作区设置</button>
              <button type="button" role="menuitem" onClick={() => { setAccountOpen(false); setOpenDrawer("help"); }}><ShieldCheck size={15} /> 查看数据边界</button>
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
              <RuntimeState title="当前没有可展示内容" body="API 返回了有效 HomeComposition，但注册组件列表为空。" action={() => void loadHome()} />
            )}
            {composition && loadState === "success" && (
              <>
                <section className="jarvis-brief" aria-labelledby="daily-judgment">
                  <div className="brief-status-line">
                    <span className="jarvis-presence"><Bot size={14} /> Jarvis daily brief</span>
                    <span>{composition.business_date} · Amazon US</span>
                    <span className={`data-state data-state-${composition.data_status.status.toLowerCase()}`}>{composition.data_status.status}</span>
                  </div>
                  <h1 id="daily-judgment" key={composition.composition_id}>{composition.top_issue.summary}</h1>
                  <p className="judgment-reason">{composition.overall_judgment}</p>
                  <div className="brief-facts">
                    <span><small>当前目标</small><strong>{objectiveLabel(composition.objective_profile)}</strong></span>
                    <span><small>置信度</small><strong>{Math.round(composition.overall_confidence * 100)}%</strong></span>
                    <span><small>最佳信号</small><strong>{composition.best_signal.summary}</strong></span>
                  </div>
                </section>

                <section className="priority-section" aria-labelledby="priority-heading">
                  <div className="section-heading-row">
                    <div><h2 id="priority-heading">现在先做什么</h2><p>按经营影响和证据确定性排序，只生成审阅草案。</p></div>
                    <button type="button" className="section-link" onClick={() => { rememberInspectorOpener(); setInspectorMode("approval"); setInspectorOpen(true); }}>查看全部草案</button>
                  </div>
                  <ol className="priority-list">
                    {composition.top_actions.map((action) => (
                      <li key={action.action_id}>
                        <button type="button" onClick={() => openAction(action)}>
                          <span className="priority-rank">{action.priority}</span>
                          <span><strong>{action.title}</strong><small>{action.reason}</small></span>
                          <span className="priority-state">审阅草案</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </section>

                <section className="quick-prompts" aria-label="快捷问题">
                  <span>追问 Jarvis</span>
                  <div>{quickQuestions.map((question) => <button type="button" key={question} onClick={() => void submitQuestion(question)}>{question}</button>)}</div>
                </section>

                {messages.length > 0 && (
                  <section className="conversation-stream" aria-label="当前对话" aria-live="polite">
                    {messages.map((message) => (
                      <article className={`chat-message chat-${message.role}`} key={message.id}>
                        <span className="message-role">{message.role === "assistant" ? "JARVIS" : "YOU"}</span>
                        <div className="message-body">
                          <p>{message.content}</p>
                          {message.response && (
                            <>
                              <div className="message-proof"><span>{message.response.findings.length} 个发现</span><span>{message.response.evidence_refs.length} 条证据</span><span>SYNTHETIC</span></div>
                              <details className="finding-disclosure">
                                <summary>检查发现与证据</summary>
                                {message.response.findings.map((finding) => (
                                  <div className="chat-finding" key={finding.finding_id}>
                                    <div><strong>{finding.claim}</strong><span>{finding.causal_status} · {Math.round(finding.confidence * 100)}%</span></div>
                                    <p>{finding.recommended_next_step}</p>
                                    <small>{finding.data_period.start.slice(0, 10)} → {finding.data_period.end.slice(0, 10)} · {finding.source.join(", ")}</small>
                                  </div>
                                ))}
                              </details>
                              {message.response.suggested_followups.length > 0 && (
                                <div className="suggested-followups">
                                  {message.response.suggested_followups.map((question) => <button type="button" key={question} onClick={() => void submitQuestion(question)}>{question}</button>)}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </article>
                    ))}
                    {chatting && <JarvisThinking />}
                  </section>
                )}

                <section className="analysis-section" aria-labelledby="analysis-heading">
                  <div className="section-heading-row">
                    <div><h2 id="analysis-heading">为什么会这样</h2><p>以下内容完全由已注册的 HomeComposition 组件组合。</p></div>
                    <span className="composition-version">HOME@{composition.schema_version} · SYNTHETIC</span>
                  </div>
                  <div className="composition-flow">
                    {composition.blocks.map((block) => (
                      <ComponentRegistry
                        key={block.block_id}
                        block={block}
                        defaultEvidenceOpen={preferences.evidenceExpanded}
                        reducedMotion={preferences.reducedMotion}
                        onOpenEvidence={openEvidence}
                        onOpenAction={openActionForBlock}
                        onSubmitFollowUp={(question) => void submitQuestion(question)}
                      />
                    ))}
                  </div>
                </section>
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
              <span>Amazon US</span><span>{composition?.business_date ?? "等待数据"}</span><span>All ASINs</span><span>SP Ads</span>
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
          onClose={closeInspector}
          onModeChange={setInspectorMode}
          onSelectAction={(action) => openAction(action)}
          onSelectEvidence={openEvidence}
        />
      </div>

      <SettingsDrawer open={openDrawer === "settings"} onClose={() => setOpenDrawer(null)} preferences={preferences} onChange={setPreferences} />
      <HelpDrawer open={openDrawer === "help"} onClose={() => setOpenDrawer(null)} />
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
      <Bot size={22} />
      <h2>Jarvis 正在组织今日经营结论</h2>
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
      <span className="message-role">JARVIS</span>
      <div className="message-body"><p>正在调用 Store Operations Agent 与确定性工具</p><span className="thinking-line"><i /><i /><i /></span></div>
    </article>
  );
}

function RuntimeState({ title, body, action }: { title: string; body: string; action?: () => void }) {
  return (
    <div className="runtime-state">
      <Bot size={22} />
      <h2>{title}</h2>
      <p>{body}</p>
      {action && <button className="secondary-command" type="button" onClick={action}>重新连接</button>}
    </div>
  );
}

function objectiveLabel(value: HomeComposition["objective_profile"]) {
  return ({
    LAUNCH_GROWTH: "新品冷启动 · 订单与排名",
    SCALE_GROWTH: "稳定放量 · 增长与库存",
    HARVEST_PROFIT: "利润收割 · 贡献利润",
    RECOVERY_RANK: "排名恢复 · 订单与 CVR",
    MIXED_STORE: "混合阶段 · 店铺整体",
  } as const)[value];
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
