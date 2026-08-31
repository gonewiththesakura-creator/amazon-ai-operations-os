"use client";

import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Database,
  FileCheck2,
  FlaskConical,
  GitBranch,
  Info,
  Layers3,
  PackageSearch,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  X
} from "lucide-react";
import type { ComponentBlock } from "../data/compositions";

type RegistryProps = { block: ComponentBlock; onAction: (action: string) => void };
type Block<T extends ComponentBlock["type"]> = Extract<ComponentBlock, { type: T }>;

function HealthBlock({ block }: { block: Block<"health"> }) {
  const Icon = block.tone === "good" ? ShieldCheck : block.tone === "warn" ? CircleAlert : Database;
  return (
    <div className={`health-item health-${block.tone}`}>
      <Icon size={14} aria-hidden="true" />
      <div>
        <span className="micro-label">{block.label}</span>
        <strong>{block.value}</strong>
        <span className="health-detail">{block.detail}</span>
      </div>
    </div>
  );
}

function BriefBlock({ block }: { block: Block<"brief"> }) {
  return (
    <section className="brief-block" aria-labelledby="brief-heading">
      <div className="brief-copy">
        <span className="section-kicker"><Sparkles size={13} aria-hidden="true" /> AI 今日简报 · {block.eyebrow}</span>
        <h1 id="brief-heading">{block.title}</h1>
        <p>{block.body}</p>
      </div>
      <div className="brief-state">
        <span className="state-label">经营状态</span>
        <strong>{({ ON_TRACK: "运行正常", BELOW_EXPECTATION: "低于预期", NO_ORDERS: "无订单", DATA_INCOMPLETE: "数据不完整" } as Record<typeof block.status, string>)[block.status]}</strong>
        <span className="confidence"><Check size={12} aria-hidden="true" /> 已关联证据</span>
      </div>
    </section>
  );
}

function MetricsBlock({ block }: { block: Block<"metrics"> }) {
  return (
    <section className="metric-row" aria-label="经营指标">
      {block.items.map((item) => (
        <div className="metric-item" key={item.label}>
          <span className="micro-label">{item.label}</span>
          <strong>{item.value}</strong>
          <span className={`metric-delta delta-${item.trend}`}>
            {item.trend === "up" ? <ArrowUpRight size={13} aria-hidden="true" /> : item.trend === "down" ? <ArrowDownRight size={13} aria-hidden="true" /> : null}
            {item.delta}
          </span>
        </div>
      ))}
    </section>
  );
}

function CausesBlock({ block }: { block: Block<"causes"> }) {
  return (
    <section className="panel causes-panel" aria-labelledby={`${block.id}-heading`}>
      <div className="panel-heading">
        <div><span className="section-kicker"><GitBranch size={13} aria-hidden="true" /> 诊断树</span><h2 id={`${block.id}-heading`}>{block.title}</h2></div>
        <span className="panel-note">{block.subtitle}</span>
      </div>
      <div className="cause-list">
        {block.items.map((item) => (
          <div className="cause-row" key={item.label}>
            <div className="cause-name"><span className={`cause-dot dot-${item.tone}`} aria-hidden="true" />{item.label}</div>
            <div className="cause-track" aria-label={`${item.label}: ${item.score} score`}><span style={{ width: `${item.score}%` }} className={`cause-fill fill-${item.tone}`} /></div>
            <strong className="cause-score">{item.score}</strong>
            <span className="cause-note">{item.note}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ActionsBlock({ block, onAction }: { block: Block<"actions">; onAction: (action: string) => void }) {
  const [openId, setOpenId] = useState(block.items[0]?.id ?? "");
  return (
    <section className="panel actions-panel" aria-labelledby={`${block.id}-heading`}>
      <div className="panel-heading"><div><span className="section-kicker"><Target size={13} aria-hidden="true" /> 决策队列</span><h2 id={`${block.id}-heading`}>{block.title}</h2></div><span className="count-pill">{block.items.length} 条待处理</span></div>
      <div className="action-list">
        {block.items.map((item) => {
          const open = openId === item.id;
          return (
            <article className={`action-row ${open ? "action-open" : ""}`} key={item.id}>
              <button className="action-toggle" onClick={() => setOpenId(open ? "" : item.id)} aria-expanded={open} aria-controls={`${item.id}-detail`}>
                <span className="action-number">{item.priority}</span><span className="action-title">{item.title}<small>{item.target}</small></span><ChevronDown size={16} className={open ? "rotate" : ""} aria-hidden="true" />
              </button>
              {open && <div className="action-detail" id={`${item.id}-detail`}>
                <div><span>预期影响</span><strong>{item.impact}</strong></div><div><span>下行风险</span><strong>{item.risk}</strong></div>
                <button className="text-button" onClick={() => onAction(item.id)}>{item.cta}<ChevronRight size={14} aria-hidden="true" /></button>
              </div>}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function EvidenceBlock({ block }: { block: Block<"evidence"> }) {
  return (
    <section className="panel evidence-panel" aria-labelledby={`${block.id}-heading`}>
      <div className="panel-heading"><div><span className="section-kicker"><FileCheck2 size={13} aria-hidden="true" /> 数据来源</span><h2 id={`${block.id}-heading`}>{block.title}</h2></div><Info size={16} aria-label="每个数值都包含来源和成熟度状态" /></div>
      <div className="evidence-table" role="table" aria-label="数据来源">
        <div className="evidence-head" role="row"><span>数据集</span><span>状态</span><span>来源</span><span>新鲜度</span></div>
        {block.rows.map((row) => <div className="evidence-row" role="row" key={row.label}><strong>{row.label}</strong><span className="table-status">{row.value}</span><code>{row.source}</code><span>{row.state}</span></div>)}
      </div>
    </section>
  );
}

const REGISTRY: Record<ComponentBlock["type"], React.ComponentType<RegistryProps>> = {
  health: ({ block }) => <HealthBlock block={block as Block<"health">} />,
  brief: ({ block }) => <BriefBlock block={block as Block<"brief">} />,
  metrics: ({ block }) => <MetricsBlock block={block as Block<"metrics">} />,
  causes: ({ block }) => <CausesBlock block={block as Block<"causes">} />,
  actions: ({ block, onAction }) => <ActionsBlock block={block as Block<"actions">} onAction={onAction} />,
  evidence: ({ block }) => <EvidenceBlock block={block as Block<"evidence">} />
};

export function ComponentRegistry({ block, onAction }: RegistryProps) {
  const Renderer = REGISTRY[block.type];
  return <Renderer block={block} onAction={onAction} />;
}

export function HealthStrip({ blocks }: { blocks: ComponentBlock[] }) {
  return <div className="health-strip" aria-label="数据健康">{blocks.filter((block): block is Block<"health"> => block.type === "health").map((block) => <HealthBlock key={block.id} block={block} />)}</div>;
}

export function EmptyState({ title, body, onReset }: { title: string; body: string; onReset: () => void }) {
  return <div className="empty-state"><Layers3 size={20} aria-hidden="true" /><h2>{title}</h2><p>{body}</p><button className="secondary-button" onClick={onReset}>返回简报</button></div>;
}
