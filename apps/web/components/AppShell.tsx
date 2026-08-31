"use client";

import { useState } from "react";
import {
  Activity,
  Archive,
  BarChart3,
  Bell,
  Check,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Command,
  FileClock,
  FlaskConical,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Package,
  PanelRightClose,
  PanelRightOpen,
  PackageSearch,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
  X
} from "lucide-react";
import { getHomeComposition, type HomeMode } from "../data/compositions";
import { ComponentRegistry, EmptyState, HealthStrip } from "./ComponentRegistry";

const navItems = [
  { label: "AI 简报", icon: LayoutDashboard },
  { label: "产品", icon: Package },
  { label: "广告", icon: Activity },
  { label: "搜索与排名", icon: Search },
  { label: "市场观察", icon: Store },
  { label: "实验", icon: FlaskConical },
  { label: "审计日志", icon: FileClock }
];

export default function AppShell() {
  const [mode, setMode] = useState<HomeMode>("NORMAL");
  const [mobileNav, setMobileNav] = useState(false);
  const [contextOpen, setContextOpen] = useState(true);
  const [activeNav, setActiveNav] = useState("AI 简报");
  const [toast, setToast] = useState("");
  const [input, setInput] = useState("");
  const composition = getHomeComposition(mode);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  };

  const action = (id: string) => notify(`已打开草案 ${id}；系统未启用任何 Amazon 写入能力。`);

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="mobile-menu" aria-label="打开导航" onClick={() => setMobileNav(true)}><Menu size={19} /></button>
        <div className="wordmark"><span className="wordmark-mark"><Sparkles size={15} /></span><span>OPS<span className="wordmark-muted">/OS</span></span></div>
        <div className="topbar-spacer" />
        <span className="environment-chip"><span className="status-dot" /> SYNTHETIC WORKSPACE</span>
        <button className="icon-button" aria-label="通知"><Bell size={17} /><span className="notification-dot" /></button>
        <button className="avatar-button" aria-label="打开账户菜单">JT</button>
      </header>
      <div className={`workspace ${contextOpen ? "" : "context-is-collapsed"}`}>
        <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`} aria-label="主导航">
          <div className="sidebar-head"><div><span className="micro-label">工作区</span><strong>Atlas Home Goods</strong></div><button className="sidebar-close" aria-label="关闭导航" onClick={() => setMobileNav(false)}><X size={17} /></button></div>
          <button className="store-select"><span className="store-icon"><Store size={14} /></span><span><b>美国站点</b><small>1 个店铺 · 20 个 ASIN</small></span><ChevronDown size={15} /></button>
          <nav className="nav-list">
            <span className="nav-section-label">运营</span>
            {navItems.slice(0, 5).map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${activeNav === label ? "nav-active" : ""}`} onClick={() => { setActiveNav(label); setMobileNav(false); }}><Icon size={16} aria-hidden="true" /><span>{label}</span>{label === "AI 简报" && <span className="nav-count">3</span>}</button>)}
            <span className="nav-section-label">分析</span>
            {navItems.slice(5).map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${activeNav === label ? "nav-active" : ""}`} onClick={() => { setActiveNav(label); setMobileNav(false); }}><Icon size={16} aria-hidden="true" /><span>{label}</span></button>)}
          </nav>
          <div className="sidebar-bottom"><div className="history-heading"><span>最近对话</span><MoreHorizontal size={15} /></div><button className="history-item history-active"><span className="history-marker" /><span><b>为什么订单下滑？</b><small>今天 · 4 条消息</small></span></button><button className="history-item"><span className="history-marker muted-marker" /><span><b>预算护栏</b><small>昨天 · 8 条消息</small></span></button><button className="history-item"><span className="history-marker muted-marker" /><span><b>Q3 补货计划</b><small>8 月 28 日 · 12 条消息</small></span></button></div>
          <div className="sidebar-footer"><button className="nav-item"><Settings2 size={16} /><span>设置</span></button><button className="nav-item"><CircleHelp size={16} /><span>帮助中心</span></button></div>
        </aside>
        {mobileNav && <button className="scrim" aria-label="关闭导航" onClick={() => setMobileNav(false)} />}
        <main className="main-column">
          <div className="main-toolbar"><div className="breadcrumb"><span>AI 简报</span><ChevronLeft size={13} /><strong>{composition.label}</strong></div><div className="toolbar-actions"><button className="toolbar-button" onClick={() => setMode(mode === "NORMAL" ? "ORDER_AD_ANOMALY" : "NORMAL")}><Command size={14} /> 切换场景 <span className="shortcut">⌘K</span></button><button className="icon-button" aria-label="归档"><Archive size={16} /></button></div></div>
          <div className="scenario-switcher" role="group" aria-label="演示场景"><span>预览状态</span><button className={mode === "NORMAL" ? "scenario-active" : ""} onClick={() => setMode("NORMAL")}>正常经营日</button><button className={mode === "ORDER_AD_ANOMALY" ? "scenario-active scenario-alert" : ""} onClick={() => setMode("ORDER_AD_ANOMALY")}>订单 / 广告异常</button></div>
          <div className="canvas-scroll"><HealthStrip blocks={composition.blocks} /><div className="composition-meta"><span className="version-badge">{composition.version}</span><span>{composition.description}</span><span className="meta-divider" /><span>synthetic=true</span></div>{composition.blocks.filter((block) => block.type !== "health").map((block) => <ComponentRegistry key={`${composition.id}-${block.id}`} block={block} onAction={action} />)}<div className="canvas-spacer" /></div>
          <div className="composer-wrap"><form className="composer" onSubmit={(event) => { event.preventDefault(); if (input.trim()) { notify("问题已加入模拟工作区队列。"); setInput(""); } }}><div className="composer-leading"><Sparkles size={16} /></div><input aria-label="向运营助手提问" placeholder="询问 ASIN、广告活动，或今天发生了什么…" value={input} onChange={(event) => setInput(event.target.value)} /><button className="composer-action" type="button" aria-label="添加上下文"><PlusIcon /></button><button className="send-button" aria-label="发送问题" type="submit"><Send size={16} /></button></form><div className="composer-note"><ShieldCheck size={12} /> 只读分析 · 每个答案都关联证据 · <span>仅使用模拟数据</span></div></div>
        </main>
        <aside className={`context-rail ${contextOpen ? "context-open" : "context-collapsed"}`} aria-label="上下文与审批">
          <button className="context-toggle" onClick={() => setContextOpen(!contextOpen)} aria-label={contextOpen ? "收起上下文栏" : "展开上下文栏"}>{contextOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}</button>
          {contextOpen && <div className="context-content"><div className="context-heading"><div><span className="section-kicker"><BookOpen size={13} /> 上下文</span><h2>当前工作集</h2></div><button className="icon-button" aria-label="更多上下文操作"><MoreHorizontal size={16} /></button></div><div className="context-card"><div className="context-card-head"><span className="context-icon"><Package size={14} /></span><span><b>SYN-ASIN-009</b><small>可充电台灯</small></span><ChevronRight size={15} /></div><div className="context-stats"><div><span>经营阶段</span><b>排名恢复</b></div><div><span>可售库存</span><b className="danger-text">0 units</b></div></div><button className="context-link" onClick={() => notify("已选择产品上下文。")}>打开产品上下文 <ChevronRight size={13} /></button></div><div className="context-section"><div className="context-section-head"><span>已固定证据</span><span className="count-pill">3</span></div><button className="evidence-link"><span className="evidence-icon"><TrendingUp size={13} /></span><span><b>库存快照</b><small>0 fulfillable · 14:10</small></span></button><button className="evidence-link"><span className="evidence-icon"><BarChart3 size={13} /></span><span><b>每日广告花费</b><small>$184 · provisional</small></span></button><button className="evidence-link"><span className="evidence-icon"><PackageSearch size={13} /></span><span><b>入库货件</b><small>ETA 9 月 04 日 · 延迟</small></span></button></div><div className="approval-card"><div className="approval-card-head"><span className="approval-icon"><FileClockIcon /></span><span><span className="micro-label">审批队列</span><b>2 条草案待审核</b></span></div><p>建议必须经过人工批准后才能进入执行记录。当前未启用外部操作。</p><button className="secondary-button" onClick={() => notify("已打开审批队列。")}>审核草案 <ChevronRight size={14} /></button></div><div className="context-footer"><span className="status-dot" /> 全部系统均为模拟</div></div>}
        </aside>
      </div>
      {toast && <div className="toast" role="status"><Check size={15} />{toast}</div>}
    </div>
  );
}

function PlusIcon() { return <span aria-hidden="true" className="plus-icon">+</span>; }
function FileClockIcon() { return <FileClock size={15} aria-hidden="true" />; }
