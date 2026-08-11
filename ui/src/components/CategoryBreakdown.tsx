import { prettyCategory } from '@/lib/format'
import type { Summary } from '@/types'

function Track({ passed, total, tone }: { passed: number; total: number; tone: string }) {
  const rate = total ? passed / total : 0
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full animate-fill rounded-full ${tone}`}
          style={{ width: `${rate * 100}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-[11px] tabular text-muted-foreground">
        {passed}/{total}
      </span>
    </div>
  )
}

export function CategoryBreakdown({
  naive,
  defended,
}: {
  naive: Summary | null
  defended: Summary | null
}) {
  const cats = [
    ...new Set([
      ...Object.keys(naive?.per_category ?? {}),
      ...Object.keys(defended?.per_category ?? {}),
    ]),
  ].sort()

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <span className="text-[12px] text-muted-foreground">
          By attack type
        </span>
        <div className="flex gap-4 text-[12px]">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-foreground/40" /> without
          </span>
          <span className="flex items-center gap-1.5 text-foreground">
            <span className="h-2 w-2 rounded-full bg-foreground" /> with defenses
          </span>
        </div>
      </div>
      <div className="divide-y divide-border">
        {cats.map((cat) => {
          const n = naive?.per_category[cat]
          const d = defended?.per_category[cat]
          return (
            <div key={cat} className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 px-5 py-3.5 sm:grid-cols-[180px_1fr_1fr]">
              <div className="col-span-2 self-center font-sans text-sm text-foreground sm:col-span-1">
                {prettyCategory(cat)}
              </div>
              <div className="self-center">
                {n ? <Track passed={n.passed} total={n.total} tone="bg-foreground/40" /> : <Dash />}
              </div>
              <div className="self-center">
                {d ? <Track passed={d.passed} total={d.total} tone="bg-foreground" /> : <Dash />}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Dash() {
  return <span className="font-mono text-[11px] text-muted-foreground/40">—</span>
}
