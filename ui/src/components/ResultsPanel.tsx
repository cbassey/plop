import { useMemo, useState } from 'react'
import { Meter } from '@/components/Meter'
import { OverviewChart } from '@/components/OverviewChart'
import { CategoryBreakdown } from '@/components/CategoryBreakdown'
import { CaseList } from '@/components/CaseList'
import { Button, Segmented } from '@/components/ui/form'
import type { ResultsFile, Study } from '@/types'
import { cn } from '@/lib/utils'
import { pct } from '@/lib/format'

type Pane = 'overview' | 'categories' | 'cases'

function adapterLabel(study: Study): string {
  const side = study.defended ?? study.naive
  const a = side?.summary.adapter ?? {}
  const kind = String(a.adapter ?? 'unknown')
  const model = a.model ? ` · ${a.model}` : ''
  const agent = a.agent ? ` · ${a.agent}` : ''
  return `${kind}${agent}${model}`
}

export function ResultsPanel({
  data,
  active,
  onSelect,
  onRefresh,
  refreshing,
}: {
  data: ResultsFile
  active: string
  onSelect: (name: string) => void
  onRefresh: () => void
  refreshing?: boolean
}) {
  const studies = data.studies
  const [pane, setPane] = useState<Pane>('overview')
  const study = useMemo(
    () => studies.find((s) => s.name === active) ?? studies[0],
    [studies, active]
  )

  if (!study) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-center">
        <div>
          <p className="font-mono text-sm text-muted-foreground">
            No results yet.
          </p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Start a study from Run, or sync existing{' '}
            <code className="text-signal">results/</code> files.
          </p>
          <Button className="mt-4" variant="ghost" onClick={onRefresh}>
            Sync results
          </Button>
        </div>
      </div>
    )
  }

  const naive = study.naive?.summary ?? null
  const defended = study.defended?.summary ?? null

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Studies
            </span>
            <button
              type="button"
              onClick={onRefresh}
              className="font-mono text-[10px] uppercase tracking-[0.15em] text-signal hover:underline"
            >
              {refreshing ? '…' : 'sync'}
            </button>
          </div>
          <ul className="max-h-[420px] overflow-auto p-2">
            {studies.map((s) => {
              const rate = s.defended?.summary.defense_rate
              const selected = s.name === study.name
              return (
                <li key={s.name}>
                  <button
                    type="button"
                    onClick={() => onSelect(s.name)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2.5 text-left transition-colors',
                      selected
                        ? 'bg-signal/15 text-foreground'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                    )}
                  >
                    <span className="truncate font-mono text-xs">{s.name}</span>
                    <span
                      className={cn(
                        'shrink-0 font-mono text-[11px] tabular',
                        selected ? 'text-signal' : 'text-muted-foreground'
                      )}
                    >
                      {rate == null ? '—' : `${pct(rate)}%`}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {studies.length > 1 && (
          <p className="px-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            {studies.length} studies loaded
          </p>
        )}
      </aside>

      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight">
              {study.name}
            </h2>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
              {adapterLabel(study)}
              {(defended ?? naive) ? (
                <>
                  {' · '}
                  {(defended ?? naive)?.total} cases
                  {defended
                    ? ` · ${defended.passed}/${defended.total} defended`
                    : ''}
                </>
              ) : null}
            </p>
          </div>
          <Segmented
            value={pane}
            onChange={setPane}
            options={[
              { value: 'overview', label: 'Overview' },
              { value: 'categories', label: 'Classes' },
              { value: 'cases', label: 'Cases' },
            ]}
          />
        </div>

        {pane === 'overview' && (
          <div className="space-y-5 animate-rise">
            <Meter
              name={study.name}
              adapter={adapterLabel(study)}
              naive={naive}
              defended={defended}
            />
            {studies.length > 1 && <OverviewChart studies={studies} />}
          </div>
        )}

        {pane === 'categories' && (
          <div className="animate-rise">
            <CategoryBreakdown naive={naive} defended={defended} />
          </div>
        )}

        {pane === 'cases' && (
          <div className="animate-rise space-y-3">
            <div className="flex items-baseline justify-between">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Case traces
              </p>
              <span className="font-mono text-[11px] text-muted-foreground">
                expand a row for the attack + traces
              </span>
            </div>
            <CaseList naive={study.naive} defended={study.defended} />
          </div>
        )}
      </div>
    </div>
  )
}
