"use client";

import type { SparklineVisualizationSpec } from "../../types/visualization";

type SparklineProps = {
  spec: SparklineVisualizationSpec;
  reducedMotion: boolean;
  tone?: "risk" | "positive";
};

export function Sparkline({ spec, reducedMotion, tone }: SparklineProps) {
  const points = plotPoints(spec.series.points.map((point) => point.value), 60, 26, 2);
  if (points.length < 2) return null;
  const direction = points.at(-1)!.y < points[0].y ? "上升" : points.at(-1)!.y > points[0].y ? "下降" : "持平";

  return (
    <svg
      className={`sparkline${tone ? ` sparkline-${tone}` : ""}${reducedMotion ? "" : " sparkline-reveal"}`}
      viewBox="0 0 60 26"
      role="img"
      aria-label={`${spec.title}，${spec.series.points.length} 个数据点，趋势${direction}`}
      preserveAspectRatio="none"
    >
      <line className="sparkline-baseline" x1="0" x2="60" y1="24.5" y2="24.5" />
      <polyline className="sparkline-path" pathLength="1" points={points.map(({ x, y }) => `${x},${y}`).join(" ")} />
    </svg>
  );
}

function plotPoints(values: number[], width: number, height: number, padding: number) {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const span = maximum - minimum || 1;
  const step = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;
  return values.map((value, index) => ({
    x: padding + step * index,
    y: padding + (1 - (value - minimum) / span) * (height - padding * 2),
  }));
}
