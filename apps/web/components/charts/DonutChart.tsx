"use client";

import type { DonutVisualizationSpec } from "../../types/visualization";
import { formatValue } from "./LineChart";

const colors = ["var(--chart-moss)", "var(--chart-bronze)", "var(--chart-slate)", "var(--chart-clay)", "var(--chart-neutral)"];
const radius = 42;
const circumference = 2 * Math.PI * radius;

export function DonutChart({ spec }: { spec: DonutVisualizationSpec }) {
  let offset = 0;
  return (
    <section className="supporting-chart" aria-label={spec.title}>
      <h4>{spec.title}</h4>
      {spec.subtitle && <p>{spec.subtitle}</p>}
      <div className="donut-layout">
        <svg className="donut-chart" viewBox="0 0 100 100" role="img" aria-label={`${spec.title}，${spec.series.values.length} 个部分`}>
          <circle className="donut-track" cx="50" cy="50" r={radius} />
          {spec.series.values.map((item, index) => {
            const share = item.value / spec.total;
            const dash = `${share * circumference} ${circumference}`;
            const currentOffset = offset;
            offset += share * circumference;
            return <circle className="donut-slice" cx="50" cy="50" key={item.label} r={radius} stroke={colors[index]} strokeDasharray={dash} strokeDashoffset={-currentOffset} />;
          })}
        </svg>
        <ul className="donut-legend">
          {spec.series.values.map((item, index) => (
            <li key={item.label}><span className="donut-swatch" style={{ background: colors[index] }} /><span>{item.label}</span><strong>{formatValue(item.value, spec.series.unit)}</strong></li>
          ))}
        </ul>
      </div>
    </section>
  );
}
