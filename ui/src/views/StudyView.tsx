import { useState } from 'react'
import { Trash2, AlertCircle } from 'lucide-react'
import {
  Meter,
  CategoryBreakdown,
  PageHeader,
  Button,
  Alert,
  AlertDescription,
  AlertTitle,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@cbassey/ui-kit'
import { CaseList } from '@/components/CaseList'
import { Glossary } from '@/components/Glossary'
import { ReviewerPanel } from '@/components/ReviewerPanel'
import { adapterLabel, deleteStudy } from '@/lib/api'
import { pct, prettyCategory } from '@/lib/format'
import type { Study } from '@/types'
import { cn } from '@/lib/utils'

type Pane = 'overview' | 'classes' | 'cases'

export function StudyView({
  study,
  onBack,
  onDeleted,
}: {
  study: Study
  onBack: () => void
  onDeleted: (studies: Study[]) => void
}) {
  const [pane, setPane] = useState<Pane>('overview')
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const naive = study.naive?.summary ?? null
  const defended = study.defended?.summary ?? null
  const lift =
    naive && defended
      ? Math.round((defended.defense_rate - naive.defense_rate) * 100)
      : null

  async function handleDelete() {
    setError(null)
    setDeleting(true)
    try {
      const result = await deleteStudy(study.name)
      onDeleted(result.studies ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setDeleting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={study.name}
        description={adapterLabel(study)}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={deleting}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete “{study.name}”?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Removes this run’s result files from disk. You can’t undo
                    that from the UI.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => void handleDelete()}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button type="button" variant="outline" size="sm" onClick={onBack}>
              All runs
            </Button>
          </div>
        }
      />

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Delete failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs
        value={pane}
        onValueChange={(v) => setPane(v as Pane)}
        className="mb-6"
      >
        <TabsList>
          <TabsTrigger value="overview">Score</TabsTrigger>
          <TabsTrigger value="classes">Attack types</TabsTrigger>
          <TabsTrigger value="cases">Attacks</TabsTrigger>
        </TabsList>
      </Tabs>

      <Glossary className="mb-8" />

      <div className={cn('animate-rise')}>
        {pane === 'overview' && (
          <div className="space-y-6">
            <p className="max-w-xl text-[14px] leading-relaxed text-muted-foreground">
              Share of attacks the agent held. Left is unprotected; right is
              with defenses on.
              {lift !== null && (
                <>
                  {' '}
                  Defenses moved the score by{' '}
                  <span className="text-foreground">
                    {lift >= 0 ? '+' : ''}
                    {lift} points
                  </span>
                  {naive && defended
                    ? ` (${pct(naive.defense_rate)}% → ${pct(defended.defense_rate)}%).`
                    : '.'}
                </>
              )}
            </p>
            <Meter
              left={
                naive && {
                  label: 'Without defenses',
                  rate: naive.defense_rate,
                  detail: `${naive.passed}/${naive.total} held${naive.skipped > 0 ? ` · ${naive.skipped} skipped` : ''}`,
                }
              }
              right={
                defended && {
                  label: 'With defenses',
                  rate: defended.defense_rate,
                  detail: `${defended.passed}/${defended.total} held${defended.skipped > 0 ? ` · ${defended.skipped} skipped` : ''}`,
                }
              }
              leftEmptyLabel="Without defenses"
              rightEmptyLabel="With defenses"
              compact
            />
            <ReviewerPanel
              study={study}
              onSeeAttacks={() => setPane('cases')}
            />
            <footer className="border-t border-border pt-5 text-[13px] text-muted-foreground">
              {(defended ?? naive)?.total ?? 0} attacks ·{' '}
              <span className="text-foreground">
                {defended
                  ? `${defended.passed}/${defended.total} held with defenses`
                  : 'defended run missing'}
              </span>
              {defended && defended.skipped > 0
                ? ` · ${defended.skipped} skipped`
                : ''}
            </footer>
          </div>
        )}

        {pane === 'classes' && (
          <div>
            <p className="mb-4 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
              Defense rate by kind of attack.
            </p>
            <CategoryBreakdown
              rows={[
                ...new Set([
                  ...Object.keys(naive?.per_category ?? {}),
                  ...Object.keys(defended?.per_category ?? {}),
                ]),
              ]
                .sort()
                .map((cat) => ({
                  label: prettyCategory(cat),
                  left: naive?.per_category[cat],
                  right: defended?.per_category[cat],
                }))}
              columnLabel="By attack type"
              legend={{ left: 'without', right: 'with defenses' }}
            />
          </div>
        )}

        {pane === 'cases' && (
          <div>
            <p className="mb-4 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
              Open a row for the full trace — what we asked, what safe looks
              like, open vs defended, and the reviewer note when one ran.
            </p>
            <CaseList naive={study.naive} defended={study.defended} />
          </div>
        )}
      </div>
    </div>
  )
}
