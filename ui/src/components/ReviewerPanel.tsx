import { Scale } from 'lucide-react'
import { caseTitle, prettyCategory } from '@/lib/format'
import {
  disagreementCount,
  judgedCount,
  studyNeedsReview,
} from '@/lib/judge'
import type { JudgeDisagreement, Study } from '@/types'

function Queue({
  label,
  items,
}: {
  label: string
  items: JudgeDisagreement[]
}) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="mb-2 text-[12px] text-muted-foreground">{label}</p>
      <ul className="space-y-2">
        {items.map((d) => (
          <li
            key={`${label}-${d.case_id}`}
            className="rounded-xl border border-border px-3.5 py-2.5"
          >
            <p className="text-[14px] text-foreground">
              {caseTitle(d.case_id)}
              <span className="ml-2 text-[12px] text-muted-foreground">
                {prettyCategory(d.category)} · hard check {d.hard_check_status}
              </span>
            </p>
            {d.rationale && (
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                {d.rationale}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ReviewerPanel({
  study,
  onSeeAttacks,
}: {
  study: Study
  onSeeAttacks: () => void
}) {
  const judged = judgedCount(study)
  if (judged === 0 && !study.naive?.summary.judge && !study.defended?.summary.judge) {
    return null
  }
  const look = studyNeedsReview(study)
  const n = disagreementCount(study)
  const naiveQ = study.naive?.summary.judge?.disagreements ?? []
  const defQ = study.defended?.summary.judge?.disagreements ?? []

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Scale className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-[15px] font-medium text-foreground">
              Reviewer
            </p>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
              {look
                ? `${n} case${n === 1 ? '' : 's'} where the second opinion disagreed with the score. The number did not change.`
                : `${judged} case${judged === 1 ? '' : 's'} read. The second opinion matched every hard check.`}
            </p>
          </div>
        </div>
        {look && (
          <button
            type="button"
            onClick={onSeeAttacks}
            className="shrink-0 text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            See attacks
          </button>
        )}
      </div>
      {look && (
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <Queue label="Without defenses" items={naiveQ} />
          <Queue label="With defenses" items={defQ} />
        </div>
      )}
    </div>
  )
}
