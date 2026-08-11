import { useCallback, useEffect, useState } from 'react'
import { RunPanel } from '@/components/RunPanel'
import { ResultsPanel } from '@/components/ResultsPanel'
import { api } from '@/api/client'
import { Segmented } from '@/components/ui/form'
import resultsFallback from '@/results.json'
import type { ResultsFile } from '@/types'
import { cn } from '@/lib/utils'

type View = 'run' | 'results'

export default function App() {
  const [view, setView] = useState<View>('run')
  const [data, setData] = useState<ResultsFile>(resultsFallback as ResultsFile)
  const [active, setActive] = useState(data.studies[0]?.name ?? '')
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(async (persist = false) => {
    setRefreshing(true)
    try {
      const next = persist ? await api.syncResults() : await api.results()
      setData(next)
      setActive((prev) =>
        next.studies.some((s) => s.name === prev)
          ? prev
          : (next.studies[0]?.name ?? '')
      )
    } catch {
      // Keep bundled fallback when API is offline.
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void refresh(false)
  }, [refresh])

  function handleFinished(studyName: string) {
    void (async () => {
      await refresh(true)
      setActive(studyName)
      setView('results')
    })()
  }

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-5 py-8 sm:px-8">
      <header className="mb-8 flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-md border border-signal/40 bg-signal/10 font-display text-lg font-extrabold text-signal">
              p
            </span>
            <div>
              <h1 className="font-display text-3xl font-extrabold tracking-tight">
                plop
              </h1>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                adversarial tool-use harness
              </p>
            </div>
          </div>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            Configure a study, run guards off then on, and read the defense
            rate — without leaving the console.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'run', label: 'Run' },
              { value: 'results', label: 'Results' },
            ]}
          />
          <span
            className={cn(
              'hidden h-2 w-2 rounded-full sm:inline-block',
              refreshing ? 'animate-pulse bg-warn' : 'bg-signal/70'
            )}
            title={refreshing ? 'syncing' : 'ready'}
          />
        </div>
      </header>

      {view === 'run' ? (
        <RunPanel onFinished={handleFinished} />
      ) : (
        <ResultsPanel
          data={data}
          active={active}
          onSelect={setActive}
          onRefresh={() => void refresh(true)}
          refreshing={refreshing}
        />
      )}
    </div>
  )
}
