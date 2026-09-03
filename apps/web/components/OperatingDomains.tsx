"use client";

import dynamic from "next/dynamic";
import {
  Boxes,
  ChevronDown,
  Megaphone,
  PackageSearch,
  Search,
  ShoppingCart,
  Telescope,
} from "lucide-react";
import type { HomeBlock } from "../types/home";
import type { VisualizationSpec } from "../types/visualization";
import {
  detailBlocksForDomain,
  domainStatusLabel,
  type OperatingDomain,
  type OperatingDomainId,
} from "../view-models/operating-domains";
import { buildDomainVisualizationModel } from "../view-models/visualizations";
import { ComponentRegistry } from "./ComponentRegistry";

const DomainAnalytics = dynamic(
  () => import("./charts/DomainAnalytics").then((module) => module.DomainAnalytics),
  { loading: () => <div className="domain-chart-loading">正在加载趋势分析…</div> },
);

type OperatingDomainsProps = {
  domains: OperatingDomain[];
  expandedIds: OperatingDomainId[];
  reducedMotion: boolean;
  visualizations: readonly VisualizationSpec[];
  onToggle: (domainId: OperatingDomainId) => void;
  onOpenAction: (block: HomeBlock) => void;
  onOpenEvidence: (block: HomeBlock) => void;
  onOpenVisualizationEvidence: (spec: VisualizationSpec) => void;
  onSubmitFollowUp: (question: string) => void;
};

const domainIcons = {
  SALES_CONVERSION: ShoppingCart,
  ADVERTISING: Megaphone,
  PRODUCT_LISTING: PackageSearch,
  INVENTORY_PROFIT: Boxes,
  SEARCH_RANKING: Search,
  MARKET_OPPORTUNITY: Telescope,
} as const;

export function OperatingDomains({
  domains,
  expandedIds,
  reducedMotion,
  visualizations,
  onToggle,
  onOpenAction,
  onOpenEvidence,
  onOpenVisualizationEvidence,
  onSubmitFollowUp,
}: OperatingDomainsProps) {
  return (
    <section className="operating-domains" aria-labelledby="operating-domains-heading">
      <div className="section-heading-row operating-domains-heading">
        <div>
          <h2 id="operating-domains-heading">经营状况</h2>
          <p>Jarvis 已按异常程度与经营影响排序，一次只展开最值得关注的领域。</p>
        </div>
      </div>

      <div className="domain-list">
        {domains.map((domain) => {
          const expanded = expandedIds.includes(domain.id);
          const Icon = domainIcons[domain.id];
          const detailBlocks = detailBlocksForDomain(domain);
          const hasAnalytics = buildDomainVisualizationModel(domain.id, visualizations) !== null;
          return (
            <article className={`domain-row domain-status-${domain.status.toLowerCase()}`} key={domain.id}>
              <button
                className="domain-summary"
                type="button"
                aria-label={`${domain.title}，${domainStatusLabel(domain.status)}，${expanded ? "收起" : "展开"}`}
                aria-expanded={expanded}
                aria-controls={`${domain.id}-detail`}
                onClick={() => onToggle(domain.id)}
              >
                <span className="domain-identity"><Icon size={17} /><strong>{domain.title}</strong></span>
                <span className="domain-copy">{domain.summary}</span>
                <span className="domain-metrics" aria-label={`${domain.title}关键指标`}>
                  {domain.metrics.slice(0, 2).map((metric) => (
                    <span key={metric.label}>
                      <small>{metric.label}</small>
                      <strong className={metric.tone ? `tone-${metric.tone}` : ""}>{metric.value}</strong>
                      {metric.note && <em>{metric.note}</em>}
                    </span>
                  ))}
                </span>
                <span className="domain-state">
                  <span>{domainStatusLabel(domain.status)}</span>
                  <ChevronDown size={16} aria-hidden="true" />
                </span>
              </button>

              {expanded && (
                <div className="domain-detail" id={`${domain.id}-detail`}>
                  {hasAnalytics ? (
                    <DomainAnalytics
                      key={domain.id}
                      domain={domain}
                      specs={visualizations}
                      reducedMotion={reducedMotion}
                      onOpenVisualizationEvidence={onOpenVisualizationEvidence}
                    />
                  ) : detailBlocks.length > 0 ? (
                    detailBlocks.map((block) => (
                      <ComponentRegistry
                        key={block.block_id}
                        block={block}
                        reducedMotion={reducedMotion}
                        onOpenEvidence={onOpenEvidence}
                        onOpenAction={onOpenAction}
                        onSubmitFollowUp={onSubmitFollowUp}
                      />
                    ))
                  ) : (
                    <div className="domain-empty">
                      <p>{domain.status === "NO_DATA" ? "当前 HomeComposition 没有该领域的新增信号。" : "摘要已覆盖当前信号，没有需要继续展开的数据。"}</p>
                      {domain.blocks[0] && (
                        <button type="button" onClick={() => onOpenEvidence(domain.blocks[0])}>在 Inspector 查看依据</button>
                      )}
                    </div>
                  )}
                  {domain.blocks.length > 5 && <p className="domain-limit">首页仅显示优先级最高的 5 项。</p>}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
