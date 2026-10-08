import { formatCompactKo } from "@/lib/format";
import styles from "./studio.module.css";

const W = 1000;
const H = 330;
const PAD = { top: 36, right: 30, bottom: 34, left: 58 };

/** "₩28만" */
const won = (v: number) => `₩${formatCompactKo(v)}`;

/** Round the axis maximum up to a clean step (Figma 287:38 uses ₩20만 steps). */
function axisMax(max: number) {
  const step = max <= 200_000 ? 50_000 : max <= 800_000 ? 200_000 : max <= 4_000_000 ? 1_000_000 : 5_000_000;
  return Math.max(step, Math.ceil(max / step) * step);
}

/** Catmull-Rom → cubic Bézier for the smooth line in the design. */
function smoothPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return points.length ? `M${points[0].x},${points[0].y}` : "";
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`;
  }
  return d;
}

/**
 * Figma 287:38 기간별 수익 그래프 — smooth area chart (purple line, gradient fill, labelled points).
 * The design draws it from ~150 rectangles; this is a plain SVG built from the server series.
 */
/** `fillId` must be unique on the page (two charts would otherwise share one gradient). */
export function RevenueChart({ series, fillId = "revenue-fill" }: { series: { label: string; amount: number }[]; fillId?: string }) {
  if (series.length === 0) {
    return <p className={styles.chartEmpty}>표시할 후원 수익이 없습니다.</p>;
  }

  const max = axisMax(Math.max(...series.map((s) => s.amount)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (series.length === 1 ? innerW / 2 : (i / (series.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const points = series.map((s, i) => ({ x: x(i), y: y(s.amount) }));
  const line = smoothPath(points);
  const area = `${line} L${points[points.length - 1].x},${PAD.top + innerH} L${points[0].x},${PAD.top + innerH} Z`;
  const ticks = [0, 1, 2, 3].map((i) => (max / 3) * i);
  // Keep labels readable on long ranges.
  const every = Math.ceil(series.length / 8);
  const showPointLabels = series.length <= 12;

  return (
    <svg className={styles.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`기간별 수익: ${series.map((s) => `${s.label} ${won(s.amount)}`).join(", ")}`}>
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(139,92,246,0.3)" />
          <stop offset="100%" stopColor="rgba(139,92,246,0.01)" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className={styles.gridLine} />
          <text x={PAD.left - 10} y={y(t) + 4} textAnchor="end" className={styles.axisText}>
            {won(t)}
          </text>
        </g>
      ))}
      <path d={area} fill={`url(#${fillId})`} />
      <path d={line} className={styles.chartLine} />
      {points.map((p, i) => (
        <g key={series[i].label}>
          <circle cx={p.x} cy={p.y} r={9} className={styles.pointHalo} />
          <circle cx={p.x} cy={p.y} r={5} className={styles.pointDot} />
          {showPointLabels && (
            <text x={p.x} y={p.y - 14} textAnchor="middle" className={styles.pointText}>
              {won(series[i].amount)}
            </text>
          )}
          {i % every === 0 && (
            <text x={p.x} y={H - 10} textAnchor="middle" className={styles.axisText}>
              {series[i].label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
