"use client";

import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Database,
  FileQuestion,
  ListChecks,
  Route,
  Sparkles,
  TableProperties,
} from "lucide-react";
import type { ComponentType, HomeBlock } from "../types/home";

type RegistryProps = {
  block: HomeBlock;
  onAction: (action: string) => void;
};

type Renderer = (props: RegistryProps) => React.ReactNode;

function text(payload: Record<string, unknown>, key: string, fallback = "—") {
  const value = payload[key];
  return typeof value === "string" ? value : fallback;
}

function number(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "number" ? value : null;
}

function formatNumber(value: number | null, options?: Intl.NumberFormatOptions) {
  return value === null ? "—" : new Intl.NumberFormat("en-US", options).format(value);
}

function BlockFrame({ block, icon, children }: { block: HomeBlock; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={`runtime-block runtime-${block.component_type}`} aria-labelledby={`${block.block_id}-heading`}>
      <header className="runtime-block-head">
        <div className="runtime-title-wrap">
          <span className="runtime-icon">{icon}</span>
          <div>
            <span className="section-kicker">{block.component_type.replaceAll("_", " ")}</span>
            <h2 id={`${block.block_id}-heading`}>{block.title}</h2>
          </div>
        </div>
        <div className="runtime-badges">
          {block.synthetic && <span className="synthetic-badge">SYNTHETIC</span>}
          <span className="confidence-badge">{Math.round(block.confidence * 100)}% confidence</span>
        </div>
      </header>
      {children}
      <details className="evidence-details">
        <summary>查看证据与口径</summary>
        <div className="evidence-detail-grid">
          <div><span>显示原因</span><strong>{block.display_reason}</strong></div>
          <div><span>数据期间</span><strong>{block.data_period.start.slice(0, 10)} → {block.data_period.end.slice(0, 10)}</strong></div>
          <div><span>来源</span><strong>{block.provenance.flatMap((item) => item.source.map((source) => source.name)).join(", ")}</strong></div>
          <div><span>更新时间</span><strong>{new Date(block.updated_at).toLocaleString()}</strong></div>
        </div>
        <div className="evidence-ref-list">
          {block.evidence_refs.map((item) => <code key={`${item.kind}:${item.reference_id}`}>{item.kind} · {item.reference_id}</code>)}
        </div>
        {block.limitations.length > 0 && <p className="limitations">限制：{block.limitations.join("；")}</p>}
      </details>
    </section>
  );
}

function ExecutiveSummary({ block }: RegistryProps) {
  const delta = number(block.payload, "orders_delta_pct");
  return (
    <BlockFrame block={block} icon={<Sparkles size={16} />}>
      <div className="executive-grid">
        <div><p className="executive-copy">{text(block.payload, "summary")}</p></div>
        <div className="executive-metric"><span>Orders</span><strong>{formatNumber(number(block.payload, "orders"))}</strong><small className={delta !== null && delta < 0 ? "negative" : "positive"}>{formatNumber(delta, { maximumFractionDigits: 1, signDisplay: "always" })}% vs baseline</small></div>
        <div className="executive-metric"><span>Sales</span><strong>{formatNumber(number(block.payload, "sales"), { style: "currency", currency: text(block.payload, "currency", "USD") })}</strong></div>
      </div>
    </BlockFrame>
  );
}

function CriticalAlert({ block }: RegistryProps) {
  return (
    <BlockFrame block={block} icon={<AlertTriangle size={16} />}>
      <p className="alert-copy">{text(block.payload, "summary")}</p>
      <div className="inline-metrics">
        <Metric label="Observed" value={formatNumber(number(block.payload, "observed_value"))} />
        <Metric label="Baseline" value={formatNumber(number(block.payload, "baseline_value"))} />
        <Metric label="Delta" value={`${formatNumber(number(block.payload, "delta_pct"), { maximumFractionDigits: 1, signDisplay: "always" })}%`} tone="negative" />
      </div>
    </BlockFrame>
  );
}

function PositiveSignal({ block }: RegistryProps) {
  const delta = number(block.payload, "delta_pct");
  return (
    <BlockFrame block={block} icon={<CheckCircle2 size={16} />}>
      <div className="signal-line"><div><span>{text(block.payload, "metric")}</span><strong>{text(block.payload, "label")}</strong></div><div className="signal-value">{formatNumber(number(block.payload, "current_value"), { maximumFractionDigits: 2 })}<small>{delta !== null && delta >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{formatNumber(delta, { maximumFractionDigits: 1, signDisplay: "always" })}%</small></div></div>
    </BlockFrame>
  );
}

function OrderFunnel({ block }: RegistryProps) {
  const sessions = number(block.payload, "sessions") ?? 0;
  const orders = number(block.payload, "orders") ?? 0;
  const units = number(block.payload, "units") ?? 0;
  const stages = [
    { label: "Sessions", value: sessions, width: 100 },
    { label: "Orders", value: orders, width: sessions ? Math.max(15, (orders / sessions) * 100) : 15 },
    { label: "Units", value: units, width: sessions ? Math.max(15, (units / sessions) * 100) : 15 },
  ];
  return (
    <BlockFrame block={block} icon={<Route size={16} />}>
      <div className="funnel-list">{stages.map((stage) => <div className="funnel-row" key={stage.label}><span>{stage.label}</span><div><i style={{ width: `${stage.width}%` }} /></div><strong>{formatNumber(stage.value)}</strong></div>)}</div>
      <span className="funnel-cvr">Unit Session Percentage <strong>{formatNumber(number(block.payload, "unit_session_percentage"), { maximumFractionDigits: 2 })}%</strong></span>
    </BlockFrame>
  );
}

function AdDiagnosis({ block }: RegistryProps) {
  return (
    <BlockFrame block={block} icon={<Activity size={16} />}>
      <p className="diagnosis-copy">{text(block.payload, "finding")}</p>
      <div className="inline-metrics">
        <Metric label="Spend" value={formatNumber(number(block.payload, "spend"), { style: "currency", currency: "USD" })} />
        <Metric label="Ad sales" value={formatNumber(number(block.payload, "ad_sales"), { style: "currency", currency: "USD" })} />
        <Metric label="ACOS" value={`${formatNumber(number(block.payload, "acos"), { maximumFractionDigits: 2 })}%`} />
        <Metric label="Attribution" value={text(block.payload, "attribution_window")} />
      </div>
    </BlockFrame>
  );
}

function PriorityAction({ block, onAction }: RegistryProps) {
  return (
    <BlockFrame block={block} icon={<ListChecks size={16} />}>
      <p className="diagnosis-copy">{text(block.payload, "summary")}</p>
      <button className="primary-command" onClick={() => onAction(block.block_id)}>打开只读建议草案</button>
    </BlockFrame>
  );
}

function DataTable({ block }: RegistryProps) {
  return (
    <BlockFrame block={block} icon={<TableProperties size={16} />}>
      <div className="data-reference"><Database size={15} /><div><strong>{text(block.payload, "summary")}</strong><code>{text(block.payload, "data_ref")}</code></div></div>
    </BlockFrame>
  );
}

function FollowUpQuestion({ block, onAction }: RegistryProps) {
  return (
    <BlockFrame block={block} icon={<FileQuestion size={16} />}>
      <button className="followup-command" onClick={() => onAction(text(block.payload, "summary"))}>{text(block.payload, "summary")}<span>→</span></button>
    </BlockFrame>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "negative" | "positive" }) {
  return <div className="inline-metric"><span>{label}</span><strong className={tone}>{value}</strong></div>;
}

const REGISTRY: Partial<Record<ComponentType, Renderer>> = {
  executive_summary: ExecutiveSummary,
  critical_alert: CriticalAlert,
  positive_signal: PositiveSignal,
  order_funnel: OrderFunnel,
  ad_diagnosis: AdDiagnosis,
  priority_action: PriorityAction,
  data_table: DataTable,
  follow_up_question: FollowUpQuestion,
};

export function UnsupportedComponentBlock({ block }: { block: HomeBlock }) {
  return (
    <section className="unsupported-block" role="status">
      <FileQuestion size={17} />
      <div><strong>Unsupported component</strong><span>{block.component_type}@{block.component_version} · {block.block_id}</span></div>
    </section>
  );
}

export function ComponentRegistry(props: RegistryProps) {
  const Renderer = REGISTRY[props.block.component_type];
  return Renderer ? <Renderer {...props} /> : <UnsupportedComponentBlock block={props.block} />;
}

