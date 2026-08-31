"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Archive,
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  FileClock,
  FlaskConical,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Package,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Store,
  X,
} from "lucide-react";
import { getHomeComposition, sendChatMessage } from "../lib/api";
import type { ChatContext, ChatResponse } from "../types/chat";
import type { HomeComposition } from "../types/home";
import { ComponentRegistry } from "./ComponentRegistry";

const navItems = [
  { label: "AI 简报", icon: LayoutDashboard },
  { label: "产品", icon: Package },
  { label: "广告", icon: Activity },
  { label: "搜索与排名", icon: Search },
  { label: "市场观察", icon: Store },
  { label: "实验", icon: FlaskConical },
  { label: "审计日志", icon: FileClock },
];

const quickQuestions = ["为什么今天订单下降？", "我现在应该先改广告吗？", "今天先处理哪三件事？"];

type LoadState = "loading" | "success" | "empty" | "error";
type Message = { id: string; role: "user" | "assistant"; content: string; response?: ChatResponse };

export default function AppShell() {
  const [mobileNav, setMobileNav] = useState(false);
  const [contextOpen, setContextOpen] = useState(true);
  const [activeNav, setActiveNav] = useState("AI 简报");
  const [toast, setToast] = useState("");
  const [input, setInput] = useState("");
  const [composition, setComposition] = useState<HomeComposition | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatting, setChatting] = useState(false);
  const [displayTimezone, setDisplayTimezone] = useState("America/Los_Angeles");

  const loadHome = useCallback(async (signal?: AbortSignal, refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoadState("loading");
    try {
      const result = await getHomeComposition(signal);
      setComposition(result);
      setLoadState(result.blocks.length ? "success" : "empty");
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

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  };

  const context = useMemo<ChatContext | null>(() => composition ? {
    business_date: composition.business_date,
    marketplace: composition.marketplace,
    selected_asin: null,
    selected_campaign: null,
    home_composition_id: composition.composition_id,
    previous_ai_run_id: [...messages].reverse().find((message) => message.response)?.response?.ai_run_id,
  } : null, [composition, messages]);

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
      setMessages((current) => [...current, { id: response.ai_run_id, role: "assistant", content: response.answer, response }]);
    } catch {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: "Jarvis 暂时无法完成分析。数据没有被修改，请检查 API 连接后重试。" }]);
    } finally {
      setChatting(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitQuestion(input);
  }

  const formattedGeneratedAt = composition
    ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short", timeZone: displayTimezone === "BROWSER_LOCAL" ? undefined : displayTimezone }).format(new Date(composition.generated_at))
    : "—";

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="mobile-menu" aria-label="打开导航" onClick={() => setMobileNav(true)}><Menu size={19} /></button>
        <div className="wordmark"><span className="wordmark-mark"><Sparkles size={15} /></span><span>OPS<span className="wordmark-muted">/OS</span></span></div>
        <div className="topbar-spacer" />
        <span className="environment-chip"><span className="status-dot" /> SYNTHETIC DATA</span>
        <span className="ai-mode-chip">{composition?.data_status.ai_mode === "ENABLED" ? "AI ENABLED" : "AI FALLBACK"}</span>
        <button className="icon-button" aria-label="通知"><Bell size={17} /></button>
        <button className="avatar-button" aria-label="打开账户菜单">JT</button>
      </header>

      <div className={`workspace ${contextOpen ? "" : "context-is-collapsed"}`}>
        <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`} aria-label="主导航">
          <div className="sidebar-head"><div><span className="micro-label">工作区</span><strong>Atlas Home Goods</strong></div><button className="sidebar-close" aria-label="关闭导航" onClick={() => setMobileNav(false)}><X size={17} /></button></div>
          <button className="store-select"><span className="store-icon"><Store size={14} /></span><span><b>美国站点</b><small>Store-level · Synthetic</small></span><ChevronDown size={15} /></button>
          <nav className="nav-list">
            <span className="nav-section-label">运营</span>
            {navItems.slice(0, 5).map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${activeNav === label ? "nav-active" : ""}`} onClick={() => { setActiveNav(label); setMobileNav(false); }}><Icon size={16} /><span>{label}</span>{label === "AI 简报" && <span className="nav-count">M1</span>}</button>)}
            <span className="nav-section-label">分析</span>
            {navItems.slice(5).map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${activeNav === label ? "nav-active" : ""}`} onClick={() => { setActiveNav(label); setMobileNav(false); }}><Icon size={16} /><span>{label}</span></button>)}
          </nav>
          <div className="sidebar-bottom"><div className="history-heading"><span>当前会话</span><MoreHorizontal size={15} /></div><div className="history-summary">{messages.length ? `${messages.length} 条消息 · 上下文持续携带` : "尚未开始追问"}</div></div>
          <div className="sidebar-footer"><button className="nav-item"><Settings2 size={16} /><span>设置</span></button><button className="nav-item"><CircleHelp size={16} /><span>帮助中心</span></button></div>
        </aside>
        {mobileNav && <button className="scrim" aria-label="关闭导航" onClick={() => setMobileNav(false)} />}

        <main className="main-column">
          <div className="main-toolbar">
            <div className="breadcrumb"><span>AI 简报</span><strong>{composition?.home_state ?? "CONNECTING"}</strong></div>
            <div className="toolbar-actions">
              <select aria-label="显示时区" value={displayTimezone} onChange={(event) => setDisplayTimezone(event.target.value)}>
                <option value="America/Los_Angeles">Los Angeles</option>
                <option value="Asia/Shanghai">中国时间</option>
                <option value="BROWSER_LOCAL">本地时间</option>
              </select>
              <button className="toolbar-button" disabled={refreshing} onClick={() => void loadHome(undefined, true)}><RefreshCw size={14} className={refreshing ? "spin" : ""} /> Refresh</button>
              <button className="icon-button" aria-label="归档"><Archive size={16} /></button>
            </div>
          </div>

          <div className="canvas-scroll">
            {loadState === "loading" && <RuntimeState title="正在读取经营数据" body="PostgreSQL → deterministic metrics → Jarvis composition" />}
            {loadState === "error" && <RuntimeState title="Home API 不可用" body="未使用本地假数据回退。请启动 FastAPI 和 PostgreSQL。" action={() => void loadHome()} />}
            {loadState === "empty" && <RuntimeState title="当前没有可展示组件" body="API 已返回有效 composition，但 blocks 为空。" action={() => void loadHome()} />}
            {composition && loadState === "success" && <>
              <section className="runtime-hero">
                <div>
                  <span className="section-kicker"><Sparkles size={13} /> JARVIS DAILY HOME · {composition.business_date}</span>
                  <h1>{composition.overall_judgment}</h1>
                  <p>{composition.top_issue.summary}</p>
                </div>
                <div className="hero-meta">
                  <span>Marketplace<strong>{composition.marketplace}</strong></span>
                  <span>Confidence<strong>{Math.round(composition.overall_confidence * 100)}%</strong></span>
                  <span>Data status<strong>{composition.data_status.status}</strong></span>
                  <span>Generated<strong>{formattedGeneratedAt}</strong></span>
                </div>
              </section>
              <div className="quick-question-row">{quickQuestions.map((question) => <button key={question} onClick={() => void submitQuestion(question)}>{question}</button>)}</div>
              {messages.length > 0 && <section className="conversation-stream" aria-live="polite">{messages.map((message) => <article className={`chat-message chat-${message.role}`} key={message.id}><span>{message.role === "assistant" ? "JARVIS" : "YOU"}</span><p>{message.content}</p>{message.response && <div className="chat-evidence"><code>{message.response.findings.length} findings</code><code>{message.response.evidence_refs.length} evidence refs</code><code>synthetic={String(message.response.synthetic)}</code></div>}</article>)}{chatting && <article className="chat-message chat-assistant"><span>JARVIS</span><p>正在调用 Store Operations Agent 与确定性工具…</p></article>}</section>}
              <div className="composition-meta"><span className="version-badge">home@{composition.schema_version}</span><span>{composition.objective_profile}</span><span className="meta-divider" /><span>business date: America/Los_Angeles</span><span className="meta-divider" /><span>synthetic={String(composition.synthetic)}</span></div>
              {composition.blocks.map((block) => <ComponentRegistry key={block.block_id} block={block} onAction={(value) => { if (value.endsWith("？") || value.endsWith("?")) setInput(value); else notify("已打开只读建议草案；未执行任何 Amazon 写操作。"); }} />)}
            </>}
            <div className="canvas-spacer" />
          </div>

          <div className="composer-wrap"><form className="composer" onSubmit={onSubmit}><div className="composer-leading"><Sparkles size={16} /></div><input aria-label="向运营助手提问" placeholder="继续追问今天发生了什么…" value={input} disabled={!composition || chatting} onChange={(event) => setInput(event.target.value)} /><button className="send-button" aria-label="发送问题" type="submit" disabled={!input.trim() || !composition || chatting}><Send size={16} /></button></form><div className="composer-note"><ShieldCheck size={12} /> 只读分析 · 答案关联证据 · <span>仅使用模拟数据</span></div></div>
        </main>

        <aside className={`context-rail ${contextOpen ? "context-open" : "context-collapsed"}`} aria-label="上下文与审批">
          <button className="context-toggle" onClick={() => setContextOpen(!contextOpen)} aria-label={contextOpen ? "收起上下文栏" : "展开上下文栏"}>{contextOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}</button>
          {contextOpen && <div className="context-content">
            <div className="context-heading"><div><span className="section-kicker"><BookOpen size={13} /> 上下文</span><h2>当前工作集</h2></div></div>
            <div className="context-card"><div className="context-card-head"><span className="context-icon"><Store size={14} /></span><span><b>Store-level context</b><small>{composition?.marketplace ?? "Waiting for API"}</small></span></div><div className="context-stats"><div><span>业务日期</span><b>{composition?.business_date ?? "—"}</b></div><div><span>首页状态</span><b>{composition?.home_state ?? "—"}</b></div></div></div>
            <div className="context-section"><div className="context-section-head"><span>当前证据</span><span className="count-pill">{composition?.blocks.reduce((sum, block) => sum + block.evidence_refs.length, 0) ?? 0}</span></div>{composition?.blocks.slice(0, 3).map((block) => <div className="evidence-link" key={block.block_id}><span className="evidence-icon"><Activity size={13} /></span><span><b>{block.title}</b><small>{block.evidence_refs[0]?.kind} · {Math.round(block.confidence * 100)}%</small></span></div>)}</div>
            <div className="approval-card"><div className="approval-card-head"><span className="approval-icon"><FileClock size={15} /></span><span><span className="micro-label">审批队列</span><b>{composition?.top_actions.filter((item) => item.requires_approval).length ?? 0} 条草案待审核</b></span></div><p>建议必须经过人工批准。M1 不注册或执行任何 Amazon 写操作。</p></div>
            <div className="context-footer"><span className="status-dot" /> {composition?.synthetic ? "SYNTHETIC DATA" : "LIVE DATA"}</div>
          </div>}
        </aside>
      </div>
      {toast && <div className="toast" role="status"><Check size={15} />{toast}</div>}
    </div>
  );
}

function RuntimeState({ title, body, action }: { title: string; body: string; action?: () => void }) {
  return <div className="runtime-state"><RefreshCw size={21} /><h2>{title}</h2><p>{body}</p>{action && <button className="secondary-button" onClick={action}>重试</button>}</div>;
}

