import { pct } from '@/lib/format'
import type { Summary } from '@/types'
import { ArrowRight } from 'lucide-react'

function Gauge({ summary, tone }: { summary: Summary; tone: 'naive' | 'defended' }) {
  const rate = summary.defense_rate
  const isDef = tone === 'defended'
  return (
    <div className="flex-1">
      <div className="mb-2 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        <span>{isDef ? 'Guards on' : 'Guards off'}</span>
        <span className="tabular">
          {summary.passed}/{summary.total}
          {summary.skipped > 0 ? ` · ${summary.skipped} n/a` : ''}
        </span>
      </div>
      <div className="flex items-end gap-2">
        <span
          className={
            'font-display text-6xl font-extrabold leading-none tabular ' +
            (isDef ? 'text-signal' : rate >= 1 ? 'text-signal' : 'text-foreground')
          }
        >
          {pct(rate)}
        </span>
        <span className="mb-1 font-mono text-sm text-muted-foreground">%</span>
      </div>
      <div className="relative mt-3 h-2 overflow-hidden rounded-sm bg-muted">
        <div
          className={
            'h-full origin-left animate-fill rounded-sm ' +
            (isDef ? 'bg-signal' : 'bg-warn')
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
}: {
  name: string
  adapter: string
  naive: Summary | null
  defended: Summary | null
}) {
  return (
    <div className="grain relative overflow-hidden rounded-lg border border-border bg-card p-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
        <div className="h-px w-1/4 animate-sweep bg-gradient-to-r from-transparent via-signal to-transparent" />
      </div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
            {name}
          </h2>
          <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {adapter}
          </p>
        </div>
        <div className="hidden h-10 w-10 place-items-center rounded-sm border border-signal/30 bg-signal/5 sm:grid">
          <span className="h-2 w-2 animate-pulse rounded-full bg-signal" />
        </div>
      </div>
      <div className="flex items-center gap-5">
        {naive ? <Gauge summary={naive} tone="naive" /> : <EmptyGauge label="No naive run" />}
        <ArrowRight className="mb-6 h-5 w-5 shrink-0 text-muted-foreground" />
        {defended ? (
          <Gauge summary={defended} tone="defended" />
        ) : (
          <EmptyGauge label="No defended run" />
        )}
      </div>
    </div>
  )
}

function EmptyGauge({ label }: { label: string }) {
  return (
    <div className="flex-1">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className="font-display text-6xl font-extrabold leading-none text-muted/40">--</div>
      <div className="mt-3 h-2 rounded-sm bg-muted" />
    </div>
  )
}
