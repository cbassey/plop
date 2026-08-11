import { pct } from '@/lib/format'
import type { Summary } from '@/types'
import { ArrowRight } from 'lucide-react'

function Gauge({
  summary,
  tone,
}: {
  summary: Summary
  tone: 'naive' | 'defended'
}) {
  const rate = summary.defense_rate
  const isDef = tone === 'defended'
  return (
    <div className="flex-1">
      <div className="mb-2 flex items-baseline justify-between text-[12px] text-muted-foreground">
        <span>{isDef ? 'With defenses' : 'Without defenses'}</span>
        <span className="tabular font-mono text-[11px]">
          {summary.passed}/{summary.total} held
          {summary.skipped > 0 ? ` · ${summary.skipped} skipped` : ''}
        </span>
      </div>
      <div className="flex items-end gap-2">
        <span className="font-display text-6xl font-extrabold leading-none tabular text-foreground">
          {pct(rate)}
        </span>
        <span className="mb-1 font-mono text-sm text-muted-foreground">%</span>
      </div>
      <div className="relative mt-3 h-1.5 overflow-hidden rounded-sm bg-muted">
        <div
          className={
            'h-full origin-left animate-fill rounded-sm ' +
            (isDef ? 'bg-foreground' : 'bg-foreground/45')
          }
          style={{ width: `${rate * 100}%` }}
        />
      </div>
    </div>
  )
}

export function Meter({
  name,
  adapter,
  naive,
  defended,
  compact,
}: {
  name: string
  adapter: string
  naive: Summary | null
  defended: Summary | null
  compact?: boolean
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6 sm:p-8">
      {!compact && (
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
              {name}
            </h2>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {adapter}
            </p>
          </div>
        </div>
      )}
      <div className="flex items-center gap-5">
        {naive ? (
          <Gauge summary={naive} tone="naive" />
        ) : (
          <EmptyGauge label="Without defenses" />
        )}
        <ArrowRight className="mb-6 h-5 w-5 shrink-0 text-muted-foreground" />
        {defended ? (
          <Gauge summary={defended} tone="defended" />
        ) : (
          <EmptyGauge label="With defenses" />
        )}
      </div>
    </div>
  )
}

function EmptyGauge({ label }: { label: string }) {
  return (
    <div className="flex-1">
      <div className="mb-2 text-[12px] text-muted-foreground">{label}</div>
      <div className="font-display text-6xl font-extrabold leading-none text-muted-foreground/40">
        --
      </div>
      <div className="mt-3 h-1.5 rounded-sm bg-muted" />
    </div>
  )
}
