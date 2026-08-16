import { useId } from 'react';
import type { ReactNode } from 'react';
import { formatDateShort, formatWeight } from '../lib/format.ts';

export interface ChartPoint {
  /** ISO instant of the completed workout. */
  at: string;
  kg: number;
}

interface Props {
  name: string;
  points: readonly ChartPoint[];
}

const W = 320;
const H = 132;
const PAD = { top: 12, right: 10, bottom: 22, left: 34 };

/**
 * A plain plot of recorded weights over time. No trend line, no projection, no
 * personal-record marker — the chart states what happened and stops there.
 */
export function ProgressChart({ name, points }: Props): ReactNode {
  const titleId = useId();

  if (points.length === 0) {
    return (
      <section className="chart" aria-labelledby={titleId}>
        <div className="chart__head">
          <h3 className="chart__name" id={titleId}>
            {name}
          </h3>
        </div>
        <p className="chart__empty">No completed workouts yet.</p>
      </section>
    );
  }

  const values = points.map((p) => p.kg);
  const times = points.map((p) => new Date(p.at).getTime());
  const minKg = Math.min(...values);
  const maxKg = Math.max(...values);
  const minT = Math.min(...times);
  const maxT = Math.max(...times);

  // A flat series would otherwise divide by zero; give it a centred band.
  const spanKg = maxKg - minKg || Math.max(5, maxKg * 0.1) || 5;
  const lowKg = maxKg === minKg ? minKg - spanKg / 2 : minKg;
  const spanT = maxT - minT || 1;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const x = (t: number): number =>
    points.length === 1 ? PAD.left + plotW / 2 : PAD.left + ((t - minT) / spanT) * plotW;
  const y = (kg: number): number => PAD.top + plotH - ((kg - lowKg) / spanKg) * plotH;

  const coords = points.map((p, i) => ({ cx: x(times[i]!), cy: y(p.kg) }));
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.cx.toFixed(2)} ${c.cy.toFixed(2)}`).join(' ');

  const first = points[0]!;
  const last = points[points.length - 1]!;

  return (
    <section className="chart" aria-labelledby={titleId}>
      <div className="chart__head">
        <h3 className="chart__name" id={titleId}>
          {name}
        </h3>
        <span className="chart__range">
          {formatWeight(last.kg)} kg · {points.length} {points.length === 1 ? 'workout' : 'workouts'}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={chartSummary(name, points)}>
        {/* Two reference lines only: the lowest and highest recorded weight. */}
        <line className="chart__grid" x1={PAD.left} x2={W - PAD.right} y1={y(maxKg)} y2={y(maxKg)} />
        <line className="chart__grid" x1={PAD.left} x2={W - PAD.right} y1={y(minKg)} y2={y(minKg)} />

        <text className="chart__axis-label" x={PAD.left - 6} y={y(maxKg) + 3} textAnchor="end">
          {formatWeight(maxKg)}
        </text>
        {minKg !== maxKg ? (
          <text className="chart__axis-label" x={PAD.left - 6} y={y(minKg) + 3} textAnchor="end">
            {formatWeight(minKg)}
          </text>
        ) : null}

        <text className="chart__axis-label" x={PAD.left} y={H - 6} textAnchor="start">
          {formatDateShort(first.at)}
        </text>
        {points.length > 1 ? (
          <text className="chart__axis-label" x={W - PAD.right} y={H - 6} textAnchor="end">
            {formatDateShort(last.at)}
          </text>
        ) : null}

        {points.length > 1 ? <path className="chart__line" d={path} /> : null}
        {coords.map((c, i) => (
          <circle key={points[i]!.at} className="chart__dot" cx={c.cx} cy={c.cy} r={2.6} />
        ))}
      </svg>
    </section>
  );
}

function chartSummary(name: string, points: readonly ChartPoint[]): string {
  const parts = points.map((p) => `${formatDateShort(p.at)}: ${formatWeight(p.kg)} kilograms`);
  return `${name} recorded weights. ${parts.join(', ')}.`;
}
