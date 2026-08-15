import { useEffect, useMemo, useRef } from 'react'
import {
  Check,
  CircleDashed,
  Scale,
  ShieldOff,
  X,
} from 'lucide-react'
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker'
import { Badge } from '@cbassey/ui-kit'
import { caseTitle } from '@/lib/format'
import { verdictLabel } from '@/lib/judge'
import {
  parseRunLog,
  phaseProgress,
  type StreamPhase,
  type StreamRow,
} from '@/lib/parse-run-log'
import { cn } from '@/lib/utils'

function MarkIcon({ row }: { row: StreamRow }) {
  if (row.mark === 'running') {
    return (
      <span className="h-1.5 w-1.5 animate-pulse rounded-sm bg-foreground" />
    )
  }
  if (row.kind === 'review') {
    if (row.mark === 'disagree') return <Scale className="h-3.5 w-3.5" />
    if (row.mark === 'unsure') return <CircleDashed className="h-3.5 w-3.5" />
    return <Check className="h-3.5 w-3.5" />
  }
  if (row.mark === 'held') return <Check className="h-3.5 w-3.5" />
  if (row.mark === 'broke') return <X className="h-3.5 w-3.5" />
  if (row.mark === 'skip') return <CircleDashed className="h-3.5 w-3.5" />
  return <ShieldOff className="h-3.5 w-3.5" />
}

function MarkMeta({ row }: { row: StreamRow }) {
  if (row.mark === 'running') {
    return (
      <span className="text-xs font-medium text-muted-foreground">Now</span>
    )
  }
  if (row.kind === 'review') {
    return (
      <span
        className={cn(
          'text-[12px]',
          row.mark === 'disagree'
            ? 'text-foreground'
            : 'text-muted-foreground'
        )}
      >
        {verdictLabel(String(row.mark))}
      </span>
    )
  }
  if (row.mark === 'held') return <Badge variant="success">held</Badge>
  if (row.mark === 'broke') return <Badge variant="error">broke</Badge>
  if (row.mark === 'skip') return <Badge variant="neutral">skipped</Badge>
  return <Badge variant="neutral">{row.mark}</Badge>
}

function PhaseBlock({
  phase,
  liveKey,
}: {
  phase: StreamPhase
  liveKey: string | null
}) {
  const { done, total } = phaseProgress(phase)
  return (
    <section>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-medium text-muted-foreground">
          {phase.title}
        </h3>
        {total > 0 && (
          <span className="tabular text-[11px] text-muted-foreground">
            {done}/{total}
          </span>
        )}
      </div>
      <div>
        {phase.rows.map((row) => {
          const live = row.key === liveKey
          return (
            <Marker
              key={row.key}
              className={cn(live && 'bg-foreground/[0.03]')}
            >
              <MarkerIcon
                className={cn(
                  live ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                <MarkIcon row={row} />
              </MarkerIcon>
              <MarkerContent>
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-[13px] text-foreground">
                    {caseTitle(row.caseId)}
                  </p>
                  <MarkMeta row={row} />
                </div>
              </MarkerContent>
            </Marker>
          )
        })}
      </div>
    </section>
  )
}

export function RunProgress({
  log,
  status,
  elapsedSec,
}: {
  log: string
  status: 'queued' | 'running' | 'done' | 'failed'
  elapsedSec: number
}) {
  const parsed = useMemo(() => parseRunLog(log), [log])
  const scroller = useRef<HTMLDivElement>(null)
  const liveKey = parsed.current?.key ?? null
  const active = parsed.phases[parsed.phases.length - 1]
  const progress = active ? phaseProgress(active) : { done: 0, total: 0 }
  const ratio =
    progress.total > 0 ? Math.min(1, progress.done / progress.total) : 0

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [log])

  const waiting = parsed.phases.length === 0

  return (
    <div className="overflow-hidden rounded-md border border-border bg-background/60">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 text-[13px] text-muted-foreground">
        <span>
          {status === 'queued'
            ? 'Starting…'
            : `Running · ${elapsedSec}s`}
        </span>
        <span>
          {active
            ? active.title
            : 'open → defended'}
        </span>
      </div>
      <div className="relative mx-4 mt-3 h-1 overflow-hidden rounded-sm bg-muted">
        {waiting ? (
          <div className="absolute inset-y-0 w-1/3 animate-sweep bg-foreground/80" />
        ) : (
          <div
            className="h-full rounded-sm bg-foreground transition-[width] duration-500 ease-out"
            style={{ width: `${Math.max(ratio * 100, 4)}%` }}
          />
        )}
      </div>
      <div
        ref={scroller}
        className="mt-3 max-h-72 space-y-5 overflow-y-auto px-4 pb-4"
      >
        {waiting ? (
          <Marker>
            <MarkerIcon>
              <span className="h-1.5 w-1.5 animate-pulse rounded-sm bg-foreground" />
            </MarkerIcon>
            <MarkerContent>
              <p className="text-[13px] text-foreground">
                {status === 'queued'
                  ? 'Queuing the suite'
                  : 'Walking the first attack'}
              </p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Offline finishes in seconds. Live API can take a few minutes.
              </p>
            </MarkerContent>
          </Marker>
        ) : (
          parsed.phases.map((phase) => (
            <PhaseBlock
              key={phase.id}
              phase={phase}
              liveKey={liveKey}
            />
          ))
        )}
      </div>
    </div>
  )
}
