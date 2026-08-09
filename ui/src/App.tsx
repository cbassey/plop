import { useMemo, useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Meter } from '@/components/Meter'
import { OverviewChart } from '@/components/OverviewChart'
import { CategoryBreakdown } from '@/components/CategoryBreakdown'
import { CaseList } from '@/components/CaseList'
import resultsData from '@/results.json'
import type { ResultsFile, Study } from '@/types'

const DATA = resultsData as ResultsFile

function adapterLabel(study: Study): string {
  const side = study.defended ?? study.naive
  const a = side?.summary.adapter ?? {}
  const kind = String(a.adapter ?? 'unknown')
  const model = a.model ? ` · ${a.model}` : ''
  const agent = a.agent ? ` · ${a.agent}` : ''
  return `${kind}${agent}${model}`
}

export default function App() {
  const studies = DATA.studies
  const [active, setActive] = useState(studies[0]?.name ?? '')
  const study = useMemo(
    () => studies.find((s) => s.name === active) ?? studies[0],
    [studies, active]
  )

  if (!study) {
    return (
      <div className="grid min-h-screen place-items-center font-mono text-muted-foreground">
        No results. Run <code className="mx-2 text-signal">npm run sync</code> after a plop run.
      </div>
    )
  }

  const naive = study.naive?.summary ?? null
  const defended = study.defended?.summary ?? null

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <header className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-md border border-signal/40 bg-signal/10 font-display text-lg font-extrabold text-signal">
              p
            </span>
            <h1 className="font-display text-3xl font-extrabold tracking-tight">plop</h1>
          </div>
          <p className="mt-2 max-w-md font-sans text-sm text-muted-foreground">
            Adversarial defense rates for tool-use agents. Each study runs the
            same suite with guards off, then on.
          </p>
        </div>
        <Tabs value={active} onValueChange={setActive}>
          <TabsList>
            {studies.map((s) => (
              <TabsTrigger key={s.name} value={s.name}>
                {s.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </header>

      {studies.length > 1 && (
        <div className="mb-6">
          <OverviewChart studies={studies} />
        </div>
      )}

      <Tabs value={active} onValueChange={setActive}>
        {studies.map((s) => (
          <TabsContent key={s.name} value={s.name} className="space-y-6">
            <Meter
              name={s.name}
              adapter={adapterLabel(s)}
              naive={s.naive?.summary ?? null}
              defended={s.defended?.summary ?? null}
            />
            <CategoryBreakdown
              naive={s.naive?.summary ?? null}
              defended={s.defended?.summary ?? null}
            />
            <div>
              <div className="mb-3 flex items-baseline justify-between">
                <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  Cases
                </h3>
                <span className="font-mono text-[11px] text-muted-foreground">
                  click a row for the trace
                </span>
              </div>
              <CaseList naive={s.naive} defended={s.defended} />
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <footer className="mt-12 border-t border-border pt-5 font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
        {naive || defended ? (
          <span>
            {study.name} · {(defended ?? naive)?.total} cases ·{' '}
            <span className="text-signal">
              {defended ? `${defended.passed}/${defended.total} defended` : 'no defended run'}
            </span>
          </span>
        ) : null}
      </footer>
    </div>
  )
}
