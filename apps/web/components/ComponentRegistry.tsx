"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Database,
  ExternalLink,
  FileQuestion,
  ListChecks,
  Route,
  Sparkles,
  TableProperties,
} from "lucide-react";
import type { ComponentType, HomeBlock } from "../types/home";

type RegistryProps = {
  block: HomeBlock;
  defaultEvidenceOpen: boolean;
  reducedMotion: boolean;
  onOpenAction: (block: HomeBlock) => void;
  onOpenEvidence: (block: HomeBlock) => void;
  onSubmitFollowUp: (question: string) => void;
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

function BlockFrame({ block, icon, children, defaultEvidenceOpen, onOpenEvidence }: {
  block: HomeBlock;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultEvidenceOpen: boolean;
  onOpenEvidence: (block: HomeBlock) => void;
}) {
  const sourceNames = block.provenance.flatMap((item) => item.source.map((source) => source.name));
  return (
    <section className={`composition-block composition-${block.component_type}`} aria-labelledby={`${block.block_id}-heading`}>
      <header className="composition-block-head">
        <div className="composition-title">
          <span className="composition-icon">{icon}</span>
          <h2 id={`${block.block_id}-heading`}>{humanizeNarrative(block.title)}</h2>
        </div>
      </header>

      {children}

      <div className="evidence-actions">
        <div className="evidence-summary">
          基于 {friendlySource(sourceNames)} · 更新于 {formatUpdatedAt(block.updated_at)}
        </div>
        <details className="evidence-disclosure" open={defaultEvidenceOpen}>
          <summary>展开来源与口径</summary>
          <dl>
            <div><dt>显示原因</dt><dd>{block.display_reason}</dd></div>
            <div><dt>数据期间</dt><dd>{block.data_period.start.slice(0, 10)} → {block.data_period.end.slice(0, 10)}</dd></div>
            <div><dt>来源</dt><dd>{sourceNames.join(", ") || "未提供"}</dd></div>
            <div><dt>更新时间</dt><dd>{new Date(block.updated_at).toLocaleString("zh-CN")}</dd></div>
          </dl>
          {block.limitations.length > 0 && <p>限制：{block.limitations.join("；")}</p>}
        </details>
        <button className="evidence-open" type="button" aria-label={`查看依据：${block.title}`} onClick={() => onOpenEvidence(block)}>
          查看依据 <ExternalLink size={13} />
        </button>
      </div>
    </section>
  );
}

function ExecutiveSummary(props: RegistryProps) {
  const { block, reducedMotion } = props;
  const delta = number(block.payload, "orders_delta_pct");
  return (
    <BlockFrame {...frameProps(props)} icon={<Sparkles size={17} />}>
      <div className="executive-summary-layout">
        <p>{text(block.payload, "summary")}</p>
        <Metric label="订单" value={<AnimatedNumber value={number(block.payload, "orders")} reducedMotion={reducedMotion} />} delta={delta} />
        <Metric label="销售额" value={formatNumber(number(block.payload, "sales"), { style: "currency", currency: text(block.payload, "currency", "USD") })} />
      </div>
    </BlockFrame>
  );
}

function CriticalAlert(props: RegistryProps) {
  const { block, reducedMotion } = props;
  return (
    <BlockFrame {...frameProps(props)} icon={<AlertTriangle size={17} />}>
      <p className="block-narrative">{humanizeNarrative(text(block.payload, "summary"))}</p>
      <div className="metric-line">
        <Metric label="今日" value={<AnimatedNumber value={number(block.payload, "observed_value")} reducedMotion={reducedMotion} />} />
        <Metric label="比较基线" value={formatNumber(number(block.payload, "baseline_value"), { maximumFractionDigits: 1 })} />
        <Metric label="变化" value={`${formatNumber(number(block.payload, "delta_pct"), { maximumFractionDigits: 1, signDisplay: "always" })}%`} tone="risk" />
      </div>
    </BlockFrame>
  );
}

function PositiveSignal(props: RegistryProps) {
  const { block, reducedMotion } = props;
  const delta = number(block.payload, "delta_pct");
  return (
    <BlockFrame {...frameProps(props)} icon={<CheckCircle2 size={17} />}>
      <div className="positive-signal-line">
        <div><span>{text(block.payload, "metric")}</span><strong>{text(block.payload, "label")}</strong></div>
        <div className="positive-signal-value">
          <AnimatedNumber value={number(block.payload, "current_value")} reducedMotion={reducedMotion} />
          <small>{delta !== null && delta >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{formatNumber(delta, { maximumFractionDigits: 1, signDisplay: "always" })}%</small>
        </div>
      </div>
    </BlockFrame>
  );
}

function OrderFunnel(props: RegistryProps) {
  const { block } = props;
  const sessions = number(block.payload, "sessions") ?? 0;
  const orders = number(block.payload, "orders") ?? 0;
  const units = number(block.payload, "units") ?? 0;
  const stages = [
    { label: "流量", value: sessions, width: 100 },
    { label: "订单", value: orders, width: sessions ? Math.max(8, (orders / sessions) * 100) : 8 },
    { label: "销量", value: units, width: sessions ? Math.max(8, (units / sessions) * 100) : 8 },
  ];
  return (
    <BlockFrame {...frameProps(props)} icon={<Route size={17} />}>
      <div className="funnel">
        {stages.map((stage) => (
          <div className="funnel-stage" key={stage.label}>
            <span>{stage.label}</span>
            <div><i style={{ width: `${stage.width}%` }} /></div>
            <strong>{formatNumber(stage.value)}</strong>
          </div>
        ))}
      </div>
      <p className="funnel-rate">转化率 <strong>{formatNumber(number(block.payload, "unit_session_percentage"), { maximumFractionDigits: 2 })}%</strong></p>
    </BlockFrame>
  );
}

function AdDiagnosis(props: RegistryProps) {
  const { block } = props;
  return (
    <BlockFrame {...frameProps(props)} icon={<Activity size={17} />}>
      <p className="block-narrative">{humanizeNarrative(text(block.payload, "finding"))}</p>
      <div className="metric-line metric-line-four">
        <Metric label="广告花费" value={formatNumber(number(block.payload, "spend"), { style: "currency", currency: "USD" })} />
        <Metric label="广告销售额" value={formatNumber(number(block.payload, "ad_sales"), { style: "currency", currency: "USD" })} />
        <Metric label="ACOS" value={`${formatNumber(number(block.payload, "acos"), { maximumFractionDigits: 2 })}%`} />
        <Metric label="归因窗口" value={humanizeAttribution(text(block.payload, "attribution_window"))} />
      </div>
    </BlockFrame>
  );
}

function PriorityAction(props: RegistryProps) {
  const { block, onOpenAction } = props;
  return (
    <BlockFrame {...frameProps(props)} icon={<ListChecks size={17} />}>
      <p className="block-narrative">{humanizeNarrative(text(block.payload, "summary"))}</p>
      <button className="primary-command" type="button" onClick={() => onOpenAction(block)}>查看建议</button>
    </BlockFrame>
  );
}

function DataTable(props: RegistryProps) {
  const { block } = props;
  return (
    <BlockFrame {...frameProps(props)} icon={<TableProperties size={17} />}>
      <div className="data-reference">
        <Database size={17} />
        <div><strong>{humanizeNarrative(text(block.payload, "summary"))}</strong><span>原始数据引用已收纳至依据面板</span></div>
      </div>
    </BlockFrame>
  );
}

function FollowUpQuestion(props: RegistryProps) {
  const { block, onSubmitFollowUp } = props;
  const question = text(block.payload, "summary");
  return (
    <BlockFrame {...frameProps(props)} icon={<FileQuestion size={17} />}>
      <button className="followup-command" type="button" onClick={() => onSubmitFollowUp(question)}>
        <span>{question}</span><span>直接追问</span>
      </button>
    </BlockFrame>
  );
}

function Metric({ label, value, delta, tone }: { label: string; value: React.ReactNode; delta?: number | null; tone?: "risk" | "positive" }) {
  const resolvedTone = tone ?? (delta !== undefined && delta !== null ? (delta < 0 ? "risk" : "positive") : undefined);
  return (
    <div className="metric-cell">
      <span>{label}</span>
      <strong className={resolvedTone ? `tone-${resolvedTone}` : ""}>{value}</strong>
      {delta !== undefined && delta !== null && <small className={`tone-${resolvedTone}`}>较基线 {formatNumber(delta, { maximumFractionDigits: 1, signDisplay: "always" })}%</small>}
    </div>
  );
}

function AnimatedNumber({ value, reducedMotion }: { value: number | null; reducedMotion: boolean }) {
  const [display, setDisplay] = useState(value ?? 0);

  useEffect(() => {
    if (value === null || reducedMotion || process.env.NODE_ENV === "test") {
      setDisplay(value ?? 0);
      return;
    }
    let frame = 0;
    const totalFrames = 16;
    const timer = window.setInterval(() => {
      frame += 1;
      const progress = 1 - Math.pow(1 - frame / totalFrames, 3);
      setDisplay(value * progress);
      if (frame >= totalFrames) window.clearInterval(timer);
    }, 24);
    return () => window.clearInterval(timer);
  }, [reducedMotion, value]);

  return <>{value === null ? "—" : formatNumber(display, { maximumFractionDigits: Number.isInteger(value) ? 0 : 2 })}</>;
}

function frameProps(props: RegistryProps) {
  return {
    block: props.block,
    defaultEvidenceOpen: props.defaultEvidenceOpen,
    onOpenEvidence: props.onOpenEvidence,
  };
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
      <div><strong>这部分内容暂时无法展示</strong><span>原始引用仍然保留，可在依据面板中检查。</span></div>
    </section>
  );
}

export function ComponentRegistry(props: RegistryProps) {
  const Renderer = REGISTRY[props.block.component_type];
  return Renderer ? <Renderer {...props} /> : <UnsupportedComponentBlock block={props.block} />;
}

function friendlySource(sourceNames: string[]) {
  if (sourceNames.some((name) => name.toLowerCase().includes("sp-api"))) return "Amazon SP 模拟数据";
  if (sourceNames.some((name) => name.toLowerCase().includes("ads"))) return "Amazon Ads 模拟数据";
  return sourceNames.length ? "已验证的模拟数据" : "已验证数据";
}

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
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

function humanizeAttribution(value: string) {
  return value === "14_DAY_CLICK" ? "14 日点击" : value.replaceAll("_", " ");
}
