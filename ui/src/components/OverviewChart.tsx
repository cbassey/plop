import { useState } from 'react'
import type { Study } from '@/types'

type Row = {
  name: string
  off: number | null
  on: number | null
  offCases: string
  onCases: string
}

function toRows(studies: Study[]): Row[] {
  return studies.map((s) => ({
    name: s.name,
    off: s.naive ? s.naive.summary.defense_rate : null,
    on: s.defended ? s.defended.summary.defense_rate : null,
    offCases: s.naive ? `${s.naive.summary.passed}/${s.naive.summary.total}` : '—',
    onCases: s.defended ? `${s.defended.summary.passed}/${s.defended.summary.total}` : '—',
  }))
}

// Fixed geometry; the SVG scales to the container via viewBox.
const W = 720
const PAD_L = 132
const PAD_R = 52
const PAD_T = 30
const ROW_H = 46
const PLOT = W - PAD_L - PAD_R

const x = (rate: number) => PAD_L + rate * PLOT

export function OverviewChart({ studies }: { studies: Study[] }) {
  const rows = toRows(studies)
  const H = PAD_T + rows.length * ROW_H + 34
  const [hover, setHover] = useState<{ label: string; x: number; y: number } | null>(null)

  return (
    <div className="relative rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Defense lift across studies
        </span>
        <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.15em]">
          <span className="flex items-center gap-1.5 text-warn">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
            guards off
          </span>
          <span className="flex items-center gap-1.5 text-signal">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <circle cx="6" cy="6" r="4.5" fill="currentColor" />
            </svg>
            guards on
          </span>
        </div>
      </div>

      <div className="overflow-x-auto p-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[520px]"
          role="img"
          aria-label="Defense rate with guards off versus on, per study"
        >
          {/* gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t} className="text-border">
              <line
                x1={x(t)}
                x2={x(t)}
                y1={PAD_T - 8}
                y2={PAD_T + rows.length * ROW_H}
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray={t === 0 || t === 1 ? '0' : '2 4'}
                opacity={t === 0 || t === 1 ? 0.7 : 0.4}
              />
              <text
                x={x(t)}
                y={PAD_T + rows.length * ROW_H + 20}
                textAnchor="middle"
                className="fill-muted-foreground font-mono"
                fontSize="11"
              >
                {t * 100}
              </text>
            </g>
          ))}

          {rows.map((r, i) => {
            const cy = PAD_T + i * ROW_H + ROW_H / 2
            const hasBoth = r.off !== null && r.on !== null
            return (
              <g key={r.name}>
                <text
                  x={0}
                  y={cy + 4}
                  className="fill-foreground font-mono"
                  fontSize="13"
                >
                  {r.name}
                </text>

                {hasBoth && (
                  <line
                    x1={x(r.off as number)}
                    x2={x(r.on as number)}
                    y1={cy}
                    y2={cy}
                    className="text-muted-foreground"
                    stroke="currentColor"
                    strokeWidth="2"
                    opacity="0.5"
                  />
                )}

                {r.off !== null && (
                  <g
                    className="text-warn"
                    onMouseEnter={() =>
                      setHover({ label: `${r.name} · off · ${r.offCases}`, x: x(r.off as number), y: cy })
                    }
                    onMouseLeave={() => setHover(null)}
                  >
                    <circle cx={x(r.off)} cy={cy} r="11" fill="transparent" />
                    <circle
                      cx={x(r.off)}
                      cy={cy}
                      r="5"
                      fill="hsl(var(--card))"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <text
                      x={x(r.off) - (r.on !== null && r.on >= r.off ? 12 : -12)}
                      y={cy + 4}
                      textAnchor={r.on !== null && r.on >= r.off ? 'end' : 'start'}
                      className="fill-warn font-mono tabular"
                      fontSize="12"
                    >
                      {Math.round(r.off * 100)}
                    </text>
                  </g>
                )}

                {r.on !== null && (
                  <g
                    className="text-signal"
                    onMouseEnter={() =>
                      setHover({ label: `${r.name} · on · ${r.onCases}`, x: x(r.on as number), y: cy })
                    }
                    onMouseLeave={() => setHover(null)}
                  >
                    <circle cx={x(r.on)} cy={cy} r="11" fill="transparent" />
                    <circle cx={x(r.on)} cy={cy} r="5.5" fill="currentColor" />
                    {!(r.off !== null && Math.abs(r.on - r.off) < 0.02) && (
                      <text
                        x={x(r.on) + 12}
                        y={cy + 4}
                        className="fill-signal font-mono tabular"
                        fontSize="12"
                      >
                        {Math.round(r.on * 100)}
                      </text>
                    )}
                  </g>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-sm border border-border bg-background px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-foreground shadow-lg"
          style={{
            left: `${(hover.x / W) * 100}%`,
            top: `${hover.y + 30}px`,
          }}
        >
          {hover.label}
        </div>
      )}
    </div>
  )
}
