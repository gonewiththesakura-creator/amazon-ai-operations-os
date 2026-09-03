"use client";

import type { BarVisualizationSpec } from "../../types/visualization";
import { formatValue } from "./LineChart";

export function HorizontalBarChart({ spec }: { spec: BarVisualizationSpec }) {
  const values = spec.series.values.slice(0, 5);
  const maximum = Math.max(...values.map((item) => Math.abs(item.value)), 1);
  return (
    <section className="supporting-chart" aria-label={spec.title}>
      <h4>{spec.title}</h4>
      {spec.subtitle && <p>{spec.subtitle}</p>}
      <ol className="bar-list">
        {values.map((item) => (
          <li className="bar-row" key={item.label}>
            <span className="bar-row-label" title={item.label}>{item.label}</span>
            <span className="bar-track"><span className={`bar-fill${item.value < 0 ? " bar-fill-risk" : ""}`} style={{ width: `${Math.abs(item.value) / maximum * 100}%` }} /></span>
            <span className="bar-value">{formatValue(item.value, spec.series.unit)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
