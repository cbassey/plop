import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { JudgeNote } from '@/components/JudgeNote'
import {
  caseTitle,
  prettyCategory,
  prettyCheck,
} from '@/lib/format'
import { recordNeedsReview } from '@/lib/judge'
import { cn } from '@/lib/utils'
import type { CaseRecord, Score, Side, ToolCall } from '@/types'

type Merged = {
  id: string
  category: string
  naive: CaseRecord | null
  defended: CaseRecord | null
}

function statusBadge(score: Score | undefined) {
  if (!score) return <Badge variant="skip">—</Badge>
  if (score.skipped) return <Badge variant="skip">skipped</Badge>
  if (score.passed) return <Badge variant="pass">held</Badge>
  return <Badge variant="fail">broke</Badge>
}

function statusWord(score: Score | undefined): string {
  if (!score) return 'Not run'
  if (score.skipped) return 'Skipped'
  if (score.passed) return 'Held'
  return 'Broke'
}

function merge(naive: Side, defended: Side): Merged[] {
  const order =
    (defended?.records.length ? defended.records : naive?.records) ?? []
  const nById = new Map((naive?.records ?? []).map((r) => [r.case_id, r]))
  const dById = new Map((defended?.records ?? []).map((r) => [r.case_id, r]))
  return order.map((r) => ({
    id: r.case_id,
    category: r.category,
    naive: nById.get(r.case_id) ?? null,
    defended: dById.get(r.case_id) ?? null,
  }))
}

function toolLine(t: ToolCall): string {
  if (t.blocked) return `Blocked ${t.name}`
  if (t.is_error) return `${t.name} returned an error`
  return `Called ${t.name}`
}

function TraceCard({
  label,
  record,
}: {
  label: string
  record: CaseRecord | null
}) {
  if (!record) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-5 py-6 text-[13px] text-muted-foreground">
        {label} — not run
      </div>
    )
  }

  const run = record.run
  const failed = record.score.checks.filter((c) => !c.passed)
  const passed = record.score.checks.filter((c) => c.passed)
  const held = record.score.passed && !record.score.skipped

  return (
    <div
      className={cn(
        'rounded-2xl border px-5 py-5',
        held
          ? 'border-foreground/20 bg-foreground/[0.03]'
          : record.score.skipped
            ? 'border-border bg-card/40'
            : 'border-border bg-transparent'
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-medium text-foreground">{label}</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {statusWord(record.score)}
            {run
              ? ` · ${run.iterations} turn${run.iterations === 1 ? '' : 's'}`
              : ''}
            {run && run.writes.length > 0
              ? ` · ${run.writes.length} write${run.writes.length === 1 ? '' : 's'}`
              : ''}
          </p>
        </div>
        {statusBadge(record.score)}
      </div>

      {record.score.skipped ? (
        <p className="text-[14px] leading-relaxed text-muted-foreground">
          {record.score.skipped_reason ||
            'Skipped — this attack needs a tool your agent doesn’t have.'}
        </p>
      ) : (
        <div className="space-y-5">
          {run && run.tool_calls.length > 0 && (
            <div>
              <p className="mb-2 text-[12px] text-muted-foreground">
                What the agent did
              </p>
              <ul className="space-y-1.5">
                {run.tool_calls.map((t, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-[14px] text-foreground"
                  >
                    <span
                      className={cn(
                        'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                        t.blocked
                          ? 'bg-foreground'
                          : t.is_error
                            ? 'bg-muted-foreground'
                            : 'bg-muted-foreground/50'
                      )}
                    />
                    <span>{toolLine(t)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {run?.final_text && (
            <div>
              <p className="mb-2 text-[12px] text-muted-foreground">
                Final answer
              </p>
              <p className="max-h-36 overflow-y-auto whitespace-pre-wrap text-[14px] leading-relaxed text-foreground/85">
                {run.final_text}
              </p>
            </div>
          )}

          {failed.length > 0 && (
            <div>
              <p className="mb-2 text-[12px] text-muted-foreground">What failed</p>
              <ul className="space-y-2">
                {failed.map((c) => (
                  <li
                    key={c.name}
                    className="rounded-xl border border-border bg-background/40 px-3.5 py-2.5"
                  >
                    <p className="text-[14px] text-foreground">
                      {prettyCheck(c.name)}
                    </p>
                    {c.detail && (
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        {c.detail}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {held && passed.length > 0 && (
            <p className="text-[12px] text-muted-foreground">
              All {passed.length} checks passed
            </p>
          )}

          <JudgeNote judgment={record.judgment} />
        </div>
      )}
    </div>
  )
}

function Row({ item }: { item: Merged }) {
  const [open, setOpen] = useState(false)
  const example = item.defended ?? item.naive
  const title = caseTitle(item.id)
  const snippet = example?.prompt.trim().replace(/\s+/g, ' ') ?? ''
  const short =
    snippet.length > 110 ? `${snippet.slice(0, 107).trimEnd()}…` : snippet

  const look =
    recordNeedsReview(item.naive) || recordNeedsReview(item.defended)

  return (
    <div className="animate-rise">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-accent/40"
      >
        <div className="flex min-w-0 items-start gap-2.5">
          <ChevronRight
            className={cn(
              'mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-90'
            )}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-medium text-foreground">
                {title}
              </span>
              <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                {prettyCategory(item.category)}
              </span>
              {look && <Badge variant="review">review</Badge>}
            </div>
            {short && (
              <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-muted-foreground">
                {short}
              </p>
            )}
          </div>
        </div>
        <div className="flex w-[4.5rem] justify-center">
          {statusBadge(item.naive?.score)}
        </div>
        <div className="flex w-[4.5rem] justify-center">
          {statusBadge(item.defended?.score)}
        </div>
      </button>

      {open && example && (
        <div className="space-y-5 border-t border-border bg-background/40 px-5 py-6">
          <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
            <div>
              <p className="mb-2 text-[12px] text-muted-foreground">
                What we asked
              </p>
              <p className="text-[15px] leading-relaxed text-foreground">
                {example.prompt.trim()}
              </p>
            </div>
            <div>
              <p className="mb-2 text-[12px] text-muted-foreground">
                Safe behavior
              </p>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                {example.expected_safe_behavior.trim()}
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <TraceCard label="Without defenses" record={item.naive} />
            <TraceCard label="With defenses" record={item.defended} />
          </div>
        </div>
      )}
    </div>
  )
}

export function CaseList({ naive, defended }: { naive: Side; defended: Side }) {
  const rows = merge(naive, defended)
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border px-5 py-3 text-[12px] text-muted-foreground">
        <span>Attack</span>
        <span className="w-[4.5rem] text-center">Open</span>
        <span className="w-[4.5rem] text-center">Defended</span>
      </div>
      <div className="max-h-[min(70vh,720px)] divide-y divide-border overflow-y-auto">
        {rows.map((item) => (
          <Row key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}
