import { Scale } from 'lucide-react'
import { verdictLabel } from '@/lib/judge'
import { cn } from '@/lib/utils'
import type { Judgment } from '@/types'

export function JudgeNote({
  judgment,
  compact,
}: {
  judgment: Judgment | undefined
  compact?: boolean
}) {
  if (!judgment) return null
  const look = judgment.verdict === 'disagree'
  return (
    <div
      className={cn(
        'rounded-xl border px-3.5 py-3',
        look
          ? 'border-foreground/30 bg-foreground/[0.04]'
          : 'border-border bg-background/40'
      )}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <Scale className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-[12px] text-muted-foreground">
          Reviewer · {verdictLabel(judgment.verdict).toLowerCase()}
          {typeof judgment.confidence === 'number' &&
          judgment.confidence > 0
            ? ` · ${Math.round(judgment.confidence * 100)}%`
            : ''}
        </p>
      </div>
      {!compact && judgment.rationale && (
        <p className="text-[14px] leading-relaxed text-foreground/85">
          {judgment.rationale}
        </p>
      )}
    </div>
  )
}
