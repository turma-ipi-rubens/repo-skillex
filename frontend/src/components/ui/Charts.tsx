/**
 * Conjunto de gráficos SVG leves (sem dependências externas) usados no
 * painel administrativo. Todos respeitam o tema via CSS variables.
 */
import { useId, useMemo, useState } from 'react';

const PALETTE = [
  '#f97316',
  '#0ea5e9',
  '#22c55e',
  '#a855f7',
  '#ef4444',
  '#eab308',
  '#14b8a6',
  '#6366f1',
  '#ec4899',
  '#84cc16',
];

export function colorAt(index: number): string {
  return PALETTE[index % PALETTE.length];
}

// ---------------------------------------------------------------------------
//  Sparkline
// ---------------------------------------------------------------------------

export function Sparkline({
  data,
  color = 'var(--color-primary)',
  height = 36,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  const w = 120;
  const h = height;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = Math.max(max - min, 1);
  const step = data.length > 1 ? w / (data.length - 1) : 0;
  const points = data
    .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / span) * (h - 4) - 2).toFixed(1)}`)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
//  Line chart (multi-série) — com eixo, grid e tooltip
// ---------------------------------------------------------------------------

export type LineSeries = {
  label: string;
  color?: string;
  data: Array<{ date: string; value: number }>;
};

export function LineChart({ series, height = 220 }: { series: LineSeries[]; height?: number }) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const w = 600;
  const h = height;
  const padL = 38;
  const padR = 12;
  const padT = 12;
  const padB = 26;
  const labels = series[0]?.data.map((d) => d.date) ?? [];
  const N = labels.length;
  const maxVal = Math.max(1, ...series.flatMap((s) => s.data.map((d) => d.value)));
  const niceMax = Math.ceil(maxVal / 5) * 5 || 5;

  const xAt = (i: number) => padL + (i * (w - padL - padR)) / Math.max(N - 1, 1);
  const yAt = (v: number) => padT + (1 - v / niceMax) * (h - padT - padB);

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  // Reduz quantidade de labels do eixo X para evitar sobreposição
  const tickIndices = useMemo(() => {
    if (N <= 7) return labels.map((_, i) => i);
    const step = Math.ceil(N / 6);
    return labels.map((_, i) => i).filter((i) => i % step === 0 || i === N - 1);
  }, [N, labels]);

  if (!N) {
    return <div className="muted" style={{ textAlign: 'center', padding: 20 }}>Sem dados.</div>;
  }

  const hoverIdx = hover ?? -1;

  return (
    <div style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * w;
          const rel = (px - padL) / (w - padL - padR);
          const idx = Math.round(rel * (N - 1));
          if (idx >= 0 && idx < N) setHover(idx);
        }}
      >
        {/* Grid horizontal */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={w - padR}
              y1={padT + g * (h - padT - padB)}
              y2={padT + g * (h - padT - padB)}
              stroke="var(--border)"
              strokeDasharray="2 4"
            />
            <text
              x={padL - 6}
              y={padT + g * (h - padT - padB) + 3}
              fontSize={9}
              textAnchor="end"
              fill="var(--text-muted)"
            >
              {Math.round(niceMax * (1 - g))}
            </text>
          </g>
        ))}

        {/* Labels X */}
        {tickIndices.map((i) => (
          <text key={i} x={xAt(i)} y={h - 8} fontSize={9} textAnchor="middle" fill="var(--text-muted)">
            {(labels[i] ?? '').slice(5)}
          </text>
        ))}

        {/* Séries */}
        {series.map((s, si) => {
          const color = s.color || colorAt(si);
          const points = s.data.map((d, i) => `${xAt(i)},${yAt(d.value)}`).join(' ');
          const areaPath =
            `M ${xAt(0)},${yAt(s.data[0].value)} ` +
            s.data.map((d, i) => `L ${xAt(i)},${yAt(d.value)}`).join(' ') +
            ` L ${xAt(N - 1)},${h - padB} L ${xAt(0)},${h - padB} Z`;
          return (
            <g key={si}>
              <defs>
                <linearGradient id={`${id}-grad-${si}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <path d={areaPath} fill={`url(#${id}-grad-${si})`} />
              <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
              {hoverIdx >= 0 && (
                <circle cx={xAt(hoverIdx)} cy={yAt(s.data[hoverIdx].value)} r={3.5} fill={color} stroke="var(--surface)" strokeWidth={1.5} />
              )}
            </g>
          );
        })}

        {/* Cursor vertical */}
        {hoverIdx >= 0 && (
          <line x1={xAt(hoverIdx)} x2={xAt(hoverIdx)} y1={padT} y2={h - padB} stroke="var(--text-soft)" strokeDasharray="2 3" />
        )}
      </svg>

      {/* Tooltip */}
      {hoverIdx >= 0 && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 8px',
            fontSize: '.75rem',
            boxShadow: 'var(--shadow-sm)',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{labels[hoverIdx]}</div>
          {series.map((s, si) => (
            <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: s.color || colorAt(si),
                }}
              />
              <span>{s.label}: <strong>{s.data[hoverIdx].value}</strong></span>
            </div>
          ))}
        </div>
      )}

      {/* Legenda */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8, fontSize: '.78rem' }}>
        {series.map((s, si) => (
          <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{ width: 10, height: 10, borderRadius: 2, background: s.color || colorAt(si) }}
            />
            <span className="muted">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Bar chart horizontal
// ---------------------------------------------------------------------------

export function BarChart({
  data,
  formatValue = (v) => String(v),
}: {
  data: Array<{ label: string; value: number; color?: string }>;
  formatValue?: (v: number) => string;
}) {
  if (!data.length) return <div className="muted" style={{ textAlign: 'center', padding: 20 }}>Sem dados.</div>;
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((d, i) => (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', marginBottom: 2 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
            <strong>{formatValue(d.value)}</strong>
          </div>
          <div
            style={{
              height: 8,
              background: 'var(--surface-2)',
              borderRadius: 999,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${(d.value / max) * 100}%`,
                height: '100%',
                background: d.color || colorAt(i),
                transition: 'width .3s ease',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Donut chart
// ---------------------------------------------------------------------------

export function DonutChart({
  data,
  size = 160,
}: {
  data: Array<{ label: string; value: number; color?: string }>;
  size?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <div className="muted" style={{ textAlign: 'center', padding: 20 }}>Sem dados.</div>;

  const r = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;
  const stroke = 18;

  let cumulative = 0;
  const arcs = data.map((d, i) => {
    const angle = (d.value / total) * Math.PI * 2;
    const start = cumulative;
    cumulative += angle;
    const x1 = cx + r * Math.cos(start - Math.PI / 2);
    const y1 = cy + r * Math.sin(start - Math.PI / 2);
    const x2 = cx + r * Math.cos(cumulative - Math.PI / 2);
    const y2 = cy + r * Math.sin(cumulative - Math.PI / 2);
    const large = angle > Math.PI ? 1 : 0;
    const path = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
    return { path, color: d.color || colorAt(i) };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        {arcs.map((a, i) => (
          <path key={i} d={a.path} fill="none" stroke={a.color} strokeWidth={stroke} strokeLinecap="butt" />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={20} fontWeight={700} fill="var(--text)">
          {total}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize={10} fill="var(--text-muted)">
          total
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '.82rem', minWidth: 120 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{ width: 10, height: 10, borderRadius: 2, background: d.color || colorAt(i), flexShrink: 0 }}
            />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
            <strong>{d.value}</strong>
            <span className="muted" style={{ fontSize: '.7rem' }}>
              {Math.round((d.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
