"use client";

import {
  Activity,
  BookOpen,
  ChevronLeft,
  ClipboardCheck,
  Database,
  FileClock,
  LockKeyhole,
  ShieldCheck,
  Store,
} from "lucide-react";
import type { ActionSummary, HomeBlock, HomeComposition } from "../types/home";
import type { VisualizationSpec } from "../types/visualization";

export type InspectorMode = "context" | "evidence" | "action" | "approval";

type InspectorProps = {
  action: ActionSummary | null;
  block: HomeBlock | null;
  composition: HomeComposition | null;
  mode: InspectorMode;
  open: boolean;
  visualization: VisualizationSpec | null;
  onClose: () => void;
  onModeChange: (mode: InspectorMode) => void;
  onSelectAction: (action: ActionSummary) => void;
  onSelectEvidence: (block: HomeBlock) => void;
};

const modeLabels: Array<{ mode: InspectorMode; label: string }> = [
  { mode: "context", label: "概览" },
  { mode: "evidence", label: "依据" },
  { mode: "action", label: "建议" },
  { mode: "approval", label: "待审阅" },
];

export function Inspector({
  action,
  block,
  composition,
  mode,
  open,
  visualization,
  onClose,
  onModeChange,
  onSelectAction,
  onSelectEvidence,
}: InspectorProps) {
  const evidenceCount = (composition?.blocks.reduce((total, item) => total + item.evidence_refs.length, 0) ?? 0)
    + (visualization?.evidence_refs?.length ?? 0);
  const approvalCount = composition?.top_actions.filter((item) => item.requires_approval).length ?? 0;

  return (
    <>
      {open && <button className="inspector-scrim" type="button" aria-label="关闭检查器" onClick={onClose} />}
      <aside
        className={`inspector ${open ? "inspector-open" : ""}`}
        aria-label="上下文与证据检查器"
        aria-hidden={!open}
        inert={!open}
      >
        <header className="inspector-head">
          <div>
            <span>今日经营</span>
            <h2>{modeLabels.find((item) => item.mode === mode)?.label}</h2>
          </div>
          <button className="icon-control inspector-close" type="button" onClick={onClose} aria-label="收起检查器">
            <ChevronLeft size={18} />
          </button>
        </header>

        <div className="inspector-tabs" role="tablist" aria-label="检查器模式">
          {modeLabels.map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={mode === item.mode}
              className={mode === item.mode ? "inspector-tab-active" : ""}
              key={item.mode}
              onClick={() => onModeChange(item.mode)}
            >
              {item.label}
              {item.mode === "evidence" && <span>{evidenceCount}</span>}
              {item.mode === "approval" && <span>{approvalCount}</span>}
            </button>
          ))}
        </div>

        <div className="inspector-body">
          {mode === "context" && <ContextPanel composition={composition} onSelectEvidence={onSelectEvidence} onSelectAction={onSelectAction} />}
          {mode === "evidence" && (visualization
            ? <VisualizationEvidencePanel visualization={visualization} />
            : <EvidencePanel block={block ?? composition?.blocks[0] ?? null} />)}
          {mode === "action" && <ActionPanel action={action ?? composition?.top_actions[0] ?? null} block={block} />}
          {mode === "approval" && <ApprovalPanel composition={composition} onSelectAction={onSelectAction} />}
        </div>

        <footer className="inspector-boundary">
          <LockKeyhole size={14} />
          <span>仅供审阅 · 不执行 Amazon 操作</span>
        </footer>
      </aside>
    </>
  );
}

function VisualizationEvidencePanel({ visualization }: { visualization: VisualizationSpec }) {
  const metrics = visualizationMetrics(visualization);
  return (
    <>
      <section className="inspector-section evidence-claim">
        <div className="inspector-section-title"><BookOpen size={15} /><h3>结论</h3></div>
        <strong>{visualization.title}</strong>
        <p>{visualization.subtitle ?? "该图仅呈现确定性工具返回的数据点。"}</p>
      </section>

      <section className="inspector-section">
        <h3>数据</h3>
        <div className="evidence-metrics">
          {metrics.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
        </div>
      </section>

      <section className="inspector-section">
        <h3>来源</h3>
        <dl className="definition-list definition-list-stacked">
          <div><dt>数据期间</dt><dd>{visualization.period}</dd></div>
          <div><dt>数据来源</dt><dd>{visualization.data_source}</dd></div>
          <div><dt>更新时间</dt><dd>{visualization.updated_at ? new Date(visualization.updated_at).toLocaleString("zh-CN") : "未提供"}</dd></div>
          <div><dt>置信度</dt><dd>{visualization.confidence === undefined ? "未提供" : `${Math.round(visualization.confidence * 100)}%`}</dd></div>
          <div><dt>数据属性</dt><dd>{visualization.synthetic ? "模拟经营数据" : "已连接数据"}</dd></div>
        </dl>
      </section>

      <section className="inspector-section">
        <h3>限制</h3>
        <p className="limitation-copy">{visualization.limitations?.length ? visualization.limitations.join("；") : "当前可视化未声明额外限制。"}</p>
        <div className="raw-reference-list">
          {visualization.evidence_refs?.map((item) => <code key={`${item.kind}:${item.reference_id}`}>{item.kind} · {item.reference_id}</code>)}
        </div>
      </section>
    </>
  );
}

function ContextPanel({ composition, onSelectEvidence, onSelectAction }: {
  composition: HomeComposition | null;
  onSelectEvidence: (block: HomeBlock) => void;
  onSelectAction: (action: ActionSummary) => void;
}) {
  if (!composition) return <InspectorEmpty title="等待经营数据" />;
  return (
    <>
      <section className="inspector-section context-overview">
        <div className="inspector-section-title"><Store size={15} /><h3>当前范围</h3></div>
        <dl className="definition-list">
          <div><dt>店铺</dt><dd>Atlas Home Goods</dd></div>
          <div><dt>站点</dt><dd>美国站</dd></div>
          <div><dt>业务日期</dt><dd>{composition.business_date}</dd></div>
          <div><dt>经营目标</dt><dd>{objectiveLabel(composition.objective_profile)}</dd></div>
          <div><dt>首页状态</dt><dd>{stateLabel(composition.home_state)}</dd></div>
          <div><dt>整体置信度</dt><dd>{Math.round(composition.overall_confidence * 100)}%</dd></div>
        </dl>
      </section>

      <section className="inspector-section">
        <div className="inspector-section-title"><Database size={15} /><h3>依据索引</h3><span>{composition.blocks.length}</span></div>
        <div className="inspector-link-list">
          {composition.blocks.slice(0, 4).map((item) => (
            <button type="button" key={item.block_id} onClick={() => onSelectEvidence(item)}>
              <span>{item.title}</span>
              <small>{item.evidence_refs.length} 条引用 · 置信度 {Math.round(item.confidence * 100)}%</small>
            </button>
          ))}
        </div>
      </section>

      <section className="inspector-section">
        <div className="inspector-section-title"><ClipboardCheck size={15} /><h3>待审阅草案</h3><span>{composition.top_actions.length}</span></div>
        <div className="inspector-link-list">
          {composition.top_actions.map((item) => (
            <button type="button" key={item.action_id} onClick={() => onSelectAction(item)}>
              <span>{item.priority}. {item.title}</span>
              <small>仅供审阅 · 需要人工确认</small>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function EvidencePanel({ block }: { block: HomeBlock | null }) {
  if (!block) return <InspectorEmpty title="选择一条证据" />;
  const sources = block.provenance.flatMap((item) => item.source);
  const rawReferences = block.provenance.flatMap((item) => item.raw_record_reference);
  const attribution = Array.from(new Set(block.provenance.map((item) => item.attribution_window))).join(", ");
  return (
    <>
      <section className="inspector-section evidence-claim">
        <div className="inspector-section-title"><BookOpen size={15} /><h3>结论</h3></div>
        <strong>{block.title}</strong>
        <p>{payloadText(block, "summary") || payloadText(block, "finding") || block.display_reason}</p>
      </section>

      <section className="inspector-section">
        <h3>数据</h3>
        <div className="evidence-metrics">
          {numericPayload(block).slice(0, 4).map(([key, value]) => (
            <div key={key}><span>{humanize(key)}</span><strong>{formatPayloadValue(key, value)}</strong></div>
          ))}
          {numericPayload(block).length === 0 && <p className="quiet-copy">此结论以文本和引用为主，没有可直接展示的数值字段。</p>}
        </div>
      </section>

      <section className="inspector-section">
        <h3>来源</h3>
        <dl className="definition-list definition-list-stacked">
          <div><dt>数据期间</dt><dd>{formatPeriod(block)}</dd></div>
          <div><dt>数据来源</dt><dd>{sources.map((source) => source.name).join(", ") || "未提供"}</dd></div>
          <div><dt>来源语义</dt><dd>{Array.from(new Set(sources.map((source) => source.semantic_source_kind))).join(", ") || "未提供"}</dd></div>
          <div><dt>更新时间</dt><dd>{new Date(block.updated_at).toLocaleString("zh-CN")}</dd></div>
          <div><dt>归因窗口</dt><dd>{attribution || "NOT_APPLICABLE"}</dd></div>
          <div><dt>置信度</dt><dd>{Math.round(block.confidence * 100)}%</dd></div>
          <div><dt>数据属性</dt><dd>{block.synthetic ? "模拟经营数据" : "真实数据"}</dd></div>
        </dl>
      </section>

      <section className="inspector-section">
        <h3>限制</h3>
        <p className="limitation-copy">{block.limitations.length ? block.limitations.join("；") : "当前组件未声明额外限制。"}</p>
        <div className="raw-reference-list">
          {block.evidence_refs.map((item) => <code key={`${item.kind}:${item.reference_id}`}>{item.kind} · {item.reference_id}</code>)}
          {rawReferences.map((item) => <code key={item}>{item}</code>)}
        </div>
      </section>
    </>
  );
}

function ActionPanel({ action, block }: { action: ActionSummary | null; block: HomeBlock | null }) {
  if (!action) return <InspectorEmpty title="选择一条行动草案" />;
  return (
    <>
      <section className="inspector-section action-brief">
        <span className="draft-status">仅供审阅</span>
        <h3>{action.title}</h3>
        <p>{action.reason}</p>
      </section>
      <section className="inspector-section">
        <dl className="definition-list definition-list-stacked">
          <div><dt>为什么现在</dt><dd>{block?.display_reason ?? "由首页确定性诊断和行动排序生成。"}</dd></div>
          <div><dt>影响范围</dt><dd>{actionImpact(action.action_type)}</dd></div>
          <div><dt>主要下行风险</dt><dd>归因尚未成熟或转化阻断未排除时，提前调整可能放大误判。</dd></div>
          <div><dt>置信度</dt><dd>{block ? `${Math.round(block.confidence * 100)}%` : "以关联证据为主"}</dd></div>
          <div><dt>观察期</dt><dd>完成只读核查后，并在相关归因窗口成熟时复盘。</dd></div>
          <div><dt>审批要求</dt><dd>{action.requires_approval ? "需要用户审阅；当前不提供执行操作" : "只读建议"}</dd></div>
        </dl>
      </section>
      <section className="inspector-section">
        <div className="inspector-section-title"><Activity size={15} /><h3>依据引用</h3></div>
        <div className="raw-reference-list">
          {action.evidence_refs.map((item) => <code key={`${item.kind}:${item.reference_id}`}>{item.kind} · {item.reference_id}</code>)}
        </div>
      </section>
      <div className="execution-boundary">
        <ShieldCheck size={17} />
        <span><strong>不会修改 Amazon</strong><small>此处没有批准或执行控件，建议只供人工审阅。</small></span>
      </div>
    </>
  );
}

function ApprovalPanel({ composition, onSelectAction }: { composition: HomeComposition | null; onSelectAction: (action: ActionSummary) => void }) {
  const actions = composition?.top_actions.filter((item) => item.requires_approval) ?? [];
  if (!actions.length) return <InspectorEmpty title="当前没有待审阅草案" />;
  return (
    <section className="approval-list" aria-label="待审阅草案">
      <p>建议可以检查，但当前不提供批准或 Amazon 执行控件。</p>
      {actions.map((item) => (
        <button type="button" key={item.action_id} onClick={() => onSelectAction(item)}>
          <span className="approval-priority">{String(item.priority).padStart(2, "0")}</span>
          <span><strong>{item.title}</strong><small>{item.action_type}</small></span>
          <FileClock size={16} />
        </button>
      ))}
    </section>
  );
}

function InspectorEmpty({ title }: { title: string }) {
  return <div className="inspector-empty"><Database size={20} /><p>{title}</p></div>;
}

function objectiveLabel(value: HomeComposition["objective_profile"]) {
  return ({
    LAUNCH_GROWTH: "新品冷启动",
    SCALE_GROWTH: "稳定放量",
    HARVEST_PROFIT: "利润收割",
    RECOVERY_RANK: "排名恢复",
    MIXED_STORE: "混合阶段店铺",
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

function actionImpact(actionType: string) {
  if (actionType.includes("AD")) return "Sponsored Products 搜索词、预算与竞价审阅";
  if (actionType.includes("ATTRIBUTION")) return "Sponsored Products 归因成熟度复盘";
  return "店铺可售、价格、Listing 与转化诊断";
}

function payloadText(block: HomeBlock, key: string) {
  const value = block.payload[key];
  return typeof value === "string" ? value : "";
}

function numericPayload(block: HomeBlock): Array<[string, number]> {
  return Object.entries(block.payload).filter((entry): entry is [string, number] => typeof entry[1] === "number");
}

function humanize(value: string) {
  return ({
    observed_value: "今日",
    baseline_value: "比较基线",
    delta_pct: "变化",
    sessions: "流量",
    orders: "订单",
    units: "销量",
    unit_session_percentage: "转化率",
    spend: "广告花费",
    ad_sales: "广告销售额",
    acos: "ACOS",
    current_value: "当前值",
  } as Record<string, string>)[value] ?? value.replaceAll("_", " ");
}

function formatPayloadValue(key: string, value: number) {
  if (key.includes("pct") || key.includes("percentage") || key === "acos") return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)}%`;
  if (key.includes("sales") || key === "spend") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatPeriod(block: HomeBlock) {
  return `${block.data_period.start.slice(0, 10)} → ${block.data_period.end.slice(0, 10)}`;
}

function visualizationMetrics(visualization: VisualizationSpec): Array<[string, string]> {
  if (visualization.type === "LINE" || visualization.type === "SPARKLINE") {
    const values = visualization.series.points.map((point) => point.value);
    return [
      ["最新值", formatVisualizationValue(values.at(-1) ?? 0, visualization.series.unit)],
      ["最低值", formatVisualizationValue(Math.min(...values), visualization.series.unit)],
      ["最高值", formatVisualizationValue(Math.max(...values), visualization.series.unit)],
      ["数据点", String(values.length)],
    ];
  }
  if (visualization.type === "BAR" || visualization.type === "DONUT") {
    const total = visualization.series.values.reduce((sum, item) => sum + item.value, 0);
    return [["分类数", String(visualization.series.values.length)], ["合计", formatVisualizationValue(total, visualization.series.unit)]];
  }
  return [["当前值", formatVisualizationValue(visualization.value, visualization.unit)], ["上限", formatVisualizationValue(visualization.max, visualization.unit)]];
}

function formatVisualizationValue(value: number, unit: string) {
  if (unit === "USD" || unit === "currency") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  if (unit === "percent" || unit === "PERCENT" || unit === "%") return `${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(value)}%`;
  if (unit === "rank") return `#${Math.round(value)}`;
  if (unit === "days") return `${Math.round(value)} 天`;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}
