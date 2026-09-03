"use client";

import { useState } from "react";
import type { LineVisualizationSpec, TimeSeriesPoint } from "../../types/visualization";

type LineChartProps = {
  spec: LineVisualizationSpec;
  reducedMotion: boolean;
  domain: "sales" | "advertising" | "ranking";
};

const width = 720;
const height = 228;
const padding = { top: 18, right: 12, bottom: 28, left: 58 };

export function LineChart({ spec, reducedMotion, domain }: LineChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const values = spec.series.points.map((point) => point.value);
  const scale = createScale(values, spec.y_axis_direction);
  const points = spec.series.points.map((point, index) => ({
    ...point,
    x: padding.left + index * ((width - padding.left - padding.right) / Math.max(spec.series.points.length - 1, 1)),
    y: scale.y(point.value),
  }));
  const active = activeIndex === null ? null : points[activeIndex];
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const xLabels = [0, Math.floor((points.length - 1) / 2), points.length - 1].filter((value, index, all) => all.indexOf(value) === index);

  return (
    <div className="line-chart-shell">
      <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${spec.title}，${spec.series.points.length} 天趋势`}>
        <title>{spec.title} · {spec.period} · {spec.synthetic ? "模拟数据" : "数据"}</title>
        {scale.ticks.map((tick) => (
          <g key={tick.value}>
            <line className="chart-grid-line" x1={padding.left} x2={width - padding.right} y1={tick.y} y2={tick.y} />
            <text className="chart-axis-label" x={padding.left - 9} y={tick.y + 3} textAnchor="end">{formatValue(tick.value, spec.series.unit, spec.y_axis_direction)}</text>
          </g>
        ))}
        {xLabels.map((index) => (
          <text className="chart-axis-label" key={index} x={points[index].x} y={height - 7} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}>
            {formatPeriod(points[index].period)}
          </text>
        ))}
        <polyline
          className={`chart-line chart-line-${domain}${reducedMotion ? "" : " chart-line-reveal"}`}
          pathLength="1"
          points={line}
        />
        {points.map((point, index) => (
          <circle
            aria-label={`${formatPeriod(point.period)}，${formatValue(point.value, spec.series.unit, spec.y_axis_direction)}`}
            className="chart-point"
            cx={point.x}
            cy={point.y}
            key={point.period}
            opacity={activeIndex === index ? 1 : 0}
            r={activeIndex === index ? 3.5 : 6}
            tabIndex={0}
            onBlur={() => setActiveIndex(null)}
            onFocus={() => setActiveIndex(index)}
            onMouseEnter={() => setActiveIndex(index)}
          />
        ))}
      </svg>
      {active && <ChartTooltip point={active} spec={spec} />}
    </div>
  );
}

function ChartTooltip({ point, spec }: { point: TimeSeriesPoint; spec: LineVisualizationSpec }) {
  return (
    <div className="chart-tooltip" role="status">
      <strong>{formatPeriod(point.period)}</strong>
      <span className="chart-tooltip-row"><span>{metricLabel(spec.series.metric)}</span><span>{formatValue(point.value, spec.series.unit, spec.y_axis_direction)}</span></span>
      <span className="chart-tooltip-row"><span>来源</span><span>{spec.synthetic ? "模拟数据" : "已连接数据"}</span></span>
    </div>
  );
}

function createScale(values: number[], direction: LineVisualizationSpec["y_axis_direction"]) {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const rawSpan = maximum - minimum;
  const margin = rawSpan === 0 ? Math.max(Math.abs(maximum) * 0.08, 1) : rawSpan * 0.12;
  const low = Math.max(direction === "INVERTED" ? 1 : 0, minimum - margin);
  const high = maximum + margin;
  const span = high - low || 1;
  const plotHeight = height - padding.top - padding.bottom;
  const y = (value: number) => direction === "INVERTED"
    ? padding.top + ((value - low) / span) * plotHeight
    : padding.top + (1 - (value - low) / span) * plotHeight;
  const ticks = Array.from({ length: 4 }, (_, index) => {
    const ratio = index / 3;
    const value = direction === "INVERTED" ? low + span * ratio : high - span * ratio;
    return { value, y: padding.top + plotHeight * ratio };
  });
  return { ticks, y };
}

export function formatValue(value: number, unit: string, direction: LineVisualizationSpec["y_axis_direction"] = "NORMAL") {
  if (direction === "INVERTED" || unit === "rank") return `#${Math.round(value)}`;
  if (unit === "USD" || unit === "currency") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  if (unit === "percent" || unit === "%") return `${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(value)}%`;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: value < 10 ? 1 : 0 }).format(value);
}

function formatPeriod(period: string) {
  const date = new Date(`${period}T12:00:00Z`);
  return Number.isNaN(date.valueOf()) ? period : new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

function metricLabel(metric: string) {
  return ({ orders: "订单", sales: "销售额", sessions: "流量", cvr: "CVR", acos: "ACOS", ad_spend: "花费", cpc: "CPC", ctr: "CTR", organic_rank: "自然排名" } as Record<string, string>)[metric] ?? metric;
}
