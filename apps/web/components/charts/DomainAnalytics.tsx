"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, ChartNoAxesCombined } from "lucide-react";
import type { VisualizationSpec } from "../../types/visualization";
import type { OperatingDomain, OperatingDomainId } from "../../view-models/operating-domains";
import { buildDomainVisualizationModel, type DomainVisualizationModel } from "../../view-models/visualizations";
import { DonutChart } from "./DonutChart";
import { HorizontalBarChart } from "./HorizontalBarChart";
import { LineChart } from "./LineChart";
import { ProgressChart } from "./ProgressChart";

type DomainAnalyticsProps = {
  domain: OperatingDomain;
  specs: readonly VisualizationSpec[];
  reducedMotion: boolean;
  onOpenVisualizationEvidence: (spec: VisualizationSpec) => void;
};

export function DomainAnalytics({ domain, specs, reducedMotion, onOpenVisualizationEvidence }: DomainAnalyticsProps) {
  const model = useMemo(() => buildDomainVisualizationModel(domain.id, specs), [domain.id, specs]);
  const [selectedMetric, setSelectedMetric] = useState(model?.selectors[0]?.metric ?? "");
  if (!model) return null;

  const selected = model.selectors.find((selector) => selector.metric === selectedMetric) ?? model.selectors[0];
  const primary = selectedPrimary(model, selectedMetric);

  return (
    <section className="domain-analytics" data-testid={`domain-analytics-${domain.id}`} aria-label={`${domain.title}可视化分析`}>
      <div className="chart-header">
        <div className="chart-title-row">
          <ChartNoAxesCombined size={17} />
          <div><h3>{primary.title}</h3><span>{primary.period}</span></div>
        </div>
        {model.selectors.length > 1 && (
          <div className="chart-selector" aria-label={`${domain.title}指标`} role="group">
            {model.selectors.map((selector) => (
              <button
                aria-pressed={selector.metric === selected?.metric}
                key={selector.metric}
                onClick={() => setSelectedMetric(selector.metric)}
                type="button"
              >
                {selector.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {primary.type === "LINE" && <LineChart spec={primary} reducedMotion={reducedMotion} domain={chartDomain(domain.id)} />}
      {primary.type === "BAR" && <HorizontalBarChart spec={primary} />}
      {primary.type === "PROGRESS" && <ProgressChart spec={primary} />}

      {model.secondary && (
        <div className="secondary-visualization">
          {model.secondary.type === "DONUT" && <DonutChart spec={model.secondary} />}
          {model.secondary.type === "BAR" && <HorizontalBarChart spec={model.secondary} />}
          {model.secondary.type === "PROGRESS" && <ProgressChart spec={model.secondary} />}
        </div>
      )}

      <div className="domain-insight">
        <span>Jarvis</span>
        <p>{domain.summary}</p>
      </div>
      <div className="domain-analytics-actions">
        <button aria-label={`查看依据：${primary.title}`} type="button" onClick={() => onOpenVisualizationEvidence(primary)}>查看数据依据 <ArrowUpRight size={13} /></button>
      </div>
    </section>
  );
}

function selectedPrimary(model: DomainVisualizationModel, selectedMetric: string): DomainVisualizationModel["primary"] {
  return model.selectors.find((selector) => selector.metric === selectedMetric)?.spec ?? model.primary;
}

function chartDomain(domainId: OperatingDomainId): "sales" | "advertising" | "ranking" {
  if (domainId === "ADVERTISING") return "advertising";
  if (domainId === "SEARCH_RANKING") return "ranking";
  return "sales";
}
