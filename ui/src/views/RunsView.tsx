import { useState } from 'react'
import { Trash2, ChevronRight } from 'lucide-react'
import { pct } from '@/lib/format'
import { adapterLabel, deleteStudy } from '@/lib/api'
import type { Study } from '@/types'
import { PageHeader, PrimaryButton } from '@/components/Shell'
import { Glossary } from '@/components/Glossary'
import { WhatIsPlop } from '@/components/WhatIsPlop'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { AlertCircle } from 'lucide-react'

export function RunsView({
  studies,
  onOpen,
  onNew,
  onDeleted,
}: {
  studies: Study[]
  onOpen: (name: string) => void
  onNew: () => void
  onDeleted: (studies: Study[]) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(name: string) {
    setError(null)
    setDeleting(name)
    try {
      const result = await deleteStudy(name)
      onDeleted(result.studies ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Team"
        title="Runs"
        description="Defense rates for tool-using agents. Each run is the same attack suite — open, then defended."
      />

      <WhatIsPlop className="mb-8" />

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Delete failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {studies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
          <p className="font-display text-xl font-medium text-foreground">
            No runs yet
          </p>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Paste a system prompt to score it, or try the offline demo to see
            how results look.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <PrimaryButton onClick={onNew}>Score my prompt</PrimaryButton>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <Glossary />
          <div className="overflow-hidden rounded-2xl border border-border">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 border-b border-border px-5 py-3 text-[12px] text-muted-foreground">
              <span>Run</span>
              <span className="w-[4.75rem] text-right">Open</span>
              <span className="w-[4.75rem] text-right">Defended</span>
              <span className="w-16" />
            </div>
            <div className="divide-y divide-border">
              {studies.map((s) => {
                const off = s.naive?.summary
                const on = s.defended?.summary
                return (
                  <div
                    key={s.name}
                    className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-accent/40"
                  >
                    <button
                      type="button"
                      onClick={() => onOpen(s.name)}
                      className="min-w-0 text-left"
                    >
                      <div className="truncate font-display text-[15px] font-medium text-foreground">
                        {s.name}
                      </div>
                      <div className="mt-0.5 truncate text-[12px] text-muted-foreground">
                        {adapterLabel(s)}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpen(s.name)}
                      className="w-[4.75rem] text-right font-display text-lg tabular text-foreground"
                    >
                      {off ? `${pct(off.defense_rate)}%` : '—'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpen(s.name)}
                      className="w-[4.75rem] text-right font-display text-lg tabular text-foreground"
                    >
                      {on ? `${pct(on.defense_rate)}%` : '—'}
                    </button>
                    <div className="flex w-16 items-center justify-end gap-0.5">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-foreground"
                            disabled={deleting === s.name}
                            aria-label={`Delete ${s.name}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete “{s.name}”?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Removes the result files for this run from disk.
                              This can’t be undone from the UI.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => void handleDelete(s.name)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onOpen(s.name)}
                        aria-label={`Open ${s.name}`}
                      >
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
