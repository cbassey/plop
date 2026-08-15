import { useCallback, useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { Shell, NavLink, PrimaryButton, Alert, AlertDescription, AlertTitle, Button } from '@cbassey/ui-kit'
import { BrandLockup, PlopMark } from '@cbassey/ui-kit/brand'
import { RunsView } from '@/views/RunsView'
import { NewRunView } from '@/views/NewRunView'
import { StudyView } from '@/views/StudyView'
import { HomeView } from '@/views/HomeView'
import { fetchResults } from '@/lib/api'
import type { Study } from '@/types'

type Route =
  | { name: 'home' }
  | { name: 'runs' }
  | { name: 'new' }
  | { name: 'study'; study: string }

export default function App() {
  const [studies, setStudies] = useState<Study[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [route, setRoute] = useState<Route>({ name: 'runs' })

  const reload = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await fetchResults()
      setStudies(data.studies)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  function handleDeleted(next: Study[]) {
    setStudies(next)
    setRoute({ name: 'runs' })
  }

  const study =
    route.name === 'study'
      ? studies.find((s) => s.name === route.study)
      : undefined

  return (
    <Shell
      brand={
        <button
          type="button"
          onClick={() => setRoute({ name: 'home' })}
          className="text-inherit transition-opacity hover:opacity-70"
          aria-label="Plop home"
        >
          <BrandLockup mark={PlopMark} name="Plop" />
        </button>
      }
      nav={
        <NavLink
          active={route.name === 'runs' || route.name === 'study'}
          onClick={() => setRoute({ name: 'runs' })}
        >
          Runs
        </NavLink>
      }
      action={
        route.name !== 'new' ? (
          <PrimaryButton onClick={() => setRoute({ name: 'new' })}>
            New run
          </PrimaryButton>
        ) : undefined
      }
    >
      {loadError && (
        <Alert variant="destructive" className="mb-8">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Couldn’t load runs</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{loadError}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void reload()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loading &&
      route.name === 'runs' &&
      studies.length === 0 &&
      !loadError ? (
        <div className="py-20 text-center text-[14px] text-muted-foreground">
          Loading studies…
        </div>
      ) : route.name === 'home' ? (
        <HomeView
          onNew={() => setRoute({ name: 'new' })}
          onSeeRuns={() => setRoute({ name: 'runs' })}
        />
      ) : route.name === 'new' ? (
        <NewRunView
          onCancel={() => setRoute({ name: 'runs' })}
          onDone={async (name) => {
            await reload()
            setRoute({ name: 'study', study: name })
          }}
        />
      ) : route.name === 'study' && study ? (
        <StudyView
          study={study}
          onBack={() => setRoute({ name: 'runs' })}
          onDeleted={handleDeleted}
        />
      ) : route.name === 'study' && !study ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
          <p className="font-display text-xl font-medium text-foreground">
            Run not found
          </p>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            It may have been deleted, or the name doesn’t match anything on
            disk.
          </p>
          <div className="mt-8">
            <PrimaryButton onClick={() => setRoute({ name: 'runs' })}>
              Back to runs
            </PrimaryButton>
          </div>
        </div>
      ) : (
        <RunsView
          studies={studies}
          onOpen={(name) => setRoute({ name: 'study', study: name })}
          onNew={() => setRoute({ name: 'new' })}
          onDeleted={handleDeleted}
        />
      )}
    </Shell>
  )
}
