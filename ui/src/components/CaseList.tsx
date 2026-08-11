import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { prettyCategory, prettyCheck } from '@/lib/format'
import type { CaseRecord, Score, Side } from '@/types'

type Merged = { id: string; category: string; naive: CaseRecord | null; defended: CaseRecord | null }

function statusBadge(score: Score | undefined) {
  if (!score) return <Badge variant="skip">—</Badge>
  if (score.skipped) return <Badge variant="skip">n/a</Badge>
  if (score.passed) return <Badge variant="pass">pass</Badge>
  return <Badge variant="fail">fail</Badge>
}

function merge(naive: Side, defended: Side): Merged[] {
  const order = (defended?.records.length ? defended.records : naive?.records) ?? []
  const nById = new Map((naive?.records ?? []).map((r) => [r.case_id, r]))
  const dById = new Map((defended?.records ?? []).map((r) => [r.case_id, r]))
  return order.map((r) => ({
    id: r.case_id,
    category: r.category,
    naive: nById.get(r.case_id) ?? null,
    defended: dById.get(r.case_id) ?? null,
  }))
}

function SideTrace({ label, record }: { label: string; record: CaseRecord | null }) {
  if (!record) return null
  const run = record.run
  const failed = record.score.checks.filter((c) => !c.passed)
  return (
    <div className="rounded-md border border-border bg-background/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </span>
        {statusBadge(record.score)}
      </div>

      {record.score.skipped ? (
        <p className="font-mono text-xs text-muted-foreground">
          {record.score.skipped_reason || 'skipped — capability not provided'}
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            <span>turns {run?.iterations ?? 0}</span>
            <span className="text-border">/</span>
            <span className={run && run.writes.length > 0 ? 'text-destructive' : ''}>
              writes {run?.writes.length ?? 0}
            </span>
            <span className="text-border">/</span>
            <span>{run?.stop_reason ?? '—'}</span>
          </div>

          {run && run.tool_calls.length > 0 && (
            <div className="space-y-1">
              {run.tool_calls.map((t, i) => (
                <div key={i} className="flex items-center gap-2 font-mono text-xs">
                  <span
                    className={
                      'inline-block h-1.5 w-1.5 rounded-full ' +
                      (t.blocked ? 'bg-signal' : t.is_error ? 'bg-warn' : 'bg-muted-foreground')
                    }
                  />
                  <span className="text-foreground">{t.name}</span>
                  {t.blocked && <span className="text-signal">blocked</span>}
                  {t.is_error && !t.blocked && <span className="text-warn">error</span>}
                </div>
              ))}
            </div>
          )}

          {run?.final_text && (
            <p className="max-h-32 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-muted-foreground">
              {run.final_text}
            </p>
          )}

          {failed.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {failed.map((c) => (
                <span
                  key={c.name}
                  className="rounded-sm border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 font-mono text-[10px] text-destructive"
                  title={c.detail}
                >
                  {prettyCheck(c.name)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ item }: { item: Merged }) {
  const [open, setOpen] = useState(false)
  const example = item.defended ?? item.naive
  return (
    <div className="animate-rise">
      <button
        onClick={() => setOpen((v) => !v)}
        className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-accent/40"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <ChevronRight
            className={'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ' + (open ? 'rotate-90' : '')}
          />
          <span className="truncate font-mono text-xs text-foreground">{item.id}</span>
          <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground md:inline">
            {prettyCategory(item.category)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">{statusBadge(item.naive?.score)}</div>
        <div className="flex items-center gap-1.5">{statusBadge(item.defended?.score)}</div>
      </button>
      {open && (
        <div className="space-y-3 border-t border-border bg-card/40 px-5 py-4">
          {example && (
            <div className="space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Attack prompt
              </p>
              <p className="font-sans text-sm text-foreground">{example.prompt}</p>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <SideTrace label="Guards off" record={item.naive} />
            <SideTrace label="Guards on" record={item.defended} />
          </div>
        </div>
      )}
    </div>
  )
}

export function CaseList({ naive, defended }: { naive: Side; defended: Side }) {
  const rows = merge(naive, defended)
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border px-5 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        <span>Case</span>
        <span className="w-12 text-center">Off</span>
        <span className="w-12 text-center">On</span>
      </div>
      <div className="max-h-[min(70vh,720px)] divide-y divide-border overflow-y-auto">
        {rows.map((item) => (
          <Row key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}
