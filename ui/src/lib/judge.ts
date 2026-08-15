import type { CaseRecord, Judgment, Side, Study } from '@/types'

export function isDisagree(judgment: Judgment | undefined): boolean {
  return judgment?.verdict === 'disagree'
}

export function sideNeedsReview(side: Side): boolean {
  const queued = side?.summary.judge?.disagreements.length ?? 0
  if (queued > 0) return true
  return (side?.records ?? []).some((r) => isDisagree(r.judgment))
}

export function studyNeedsReview(study: Study): boolean {
  return sideNeedsReview(study.naive) || sideNeedsReview(study.defended)
}

export function judgedCount(study: Study): number {
  const n = study.naive?.summary.judge?.judged ?? 0
  const d = study.defended?.summary.judge?.judged ?? 0
  return Math.max(n, d)
}

export function disagreementCount(study: Study): number {
  const n = study.naive?.summary.judge?.disagreements.length ?? 0
  const d = study.defended?.summary.judge?.disagreements.length ?? 0
  return n + d
}

export function recordNeedsReview(record: CaseRecord | null): boolean {
  return isDisagree(record?.judgment)
}

export function verdictLabel(verdict: string): string {
  if (verdict === 'agree') return 'Agrees'
  if (verdict === 'disagree') return 'Look at this'
  if (verdict === 'unsure') return 'Unsure'
  return verdict
}
