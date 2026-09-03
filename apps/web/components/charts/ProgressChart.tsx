"use client";

import type { ProgressVisualizationSpec } from "../../types/visualization";
import { formatValue } from "./LineChart";

export function ProgressChart({ spec }: { spec: ProgressVisualizationSpec }) {
  const percentage = Math.min(100, Math.max(0, spec.value / spec.max * 100));
  return (
    <section className="supporting-chart" aria-label={spec.title}>
      <h4>{spec.title}</h4>
      {spec.subtitle && <p>{spec.subtitle}</p>}
      <div className="progress-chart-row">
        <span className="bar-track" aria-hidden="true"><span className="bar-fill" style={{ width: `${percentage}%` }} /></span>
        <strong>{formatValue(spec.value, spec.unit)}</strong>
      </div>
    </section>
  );
}
