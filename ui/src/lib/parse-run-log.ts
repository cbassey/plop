/** Turn harness/judge stderr into status rows for the live run UI. */

export type AttackMark =
  | 'running'
  | 'held'
  | 'broke'
  | 'skip'
  | 'unverifiable'

export type ReviewMark = 'running' | 'agree' | 'disagree' | 'unsure'

export type StreamKind = 'attack' | 'review'

export type StreamRow = {
  key: string
  caseId: string
  index: number
  total: number
  kind: StreamKind
  mark: AttackMark | ReviewMark
}

export type PhaseKind = 'open' | 'defended' | 'review'

export type StreamPhase = {
  id: string
  kind: PhaseKind
  title: string
  rows: StreamRow[]
}

export type ParsedRunLog = {
  phases: StreamPhase[]
  current: StreamRow | null
}

const CASE_LINE = /^\[(\d+)\/(\d+)\]\s+(\S+)\s+(\S+)\s*$/
const HARNESS_LINE = /python\s+-m\s+plop\.harness/
const JUDGE_LINE = /python\s+-m\s+plop\.judge/

const RUNNING = new Set(['…', '..', '...'])
const ATTACK_DONE = new Set([
  'held',
  'broke',
  'skip',
  'skipped',
  'unverifiable',
])
const REVIEW_DONE = new Set(['agree', 'disagree', 'unsure'])

function normalizeMark(
  raw: string
): { kind: StreamKind | 'running'; mark: AttackMark | ReviewMark } | null {
  if (RUNNING.has(raw)) {
    return { kind: 'running', mark: 'running' }
  }
  if (raw === 'skipped') return { kind: 'attack', mark: 'skip' }
  if (ATTACK_DONE.has(raw)) {
    return { kind: 'attack', mark: raw as AttackMark }
  }
  if (REVIEW_DONE.has(raw)) {
    return { kind: 'review', mark: raw as ReviewMark }
  }
  return null
}

function upsert(phase: StreamPhase, row: StreamRow) {
  const existing = phase.rows.find((r) => r.caseId === row.caseId)
  if (existing) {
    existing.index = row.index
    existing.total = row.total
    existing.kind = row.kind
    existing.mark = row.mark
    return
  }
  phase.rows.push(row)
}

function startPhase(
  phases: StreamPhase[],
  kind: PhaseKind,
  title: string
): StreamPhase {
  const last = phases[phases.length - 1]
  if (last && last.kind === kind && last.title === title) return last
  const phase: StreamPhase = {
    id: `${kind}-${phases.length}`,
    kind,
    title,
    rows: [],
  }
  phases.push(phase)
  return phase
}

function sideFromHarness(line: string): PhaseKind {
  if (/\s--defended\b/.test(line) || /-defended\b/.test(line)) {
    return 'defended'
  }
  return 'open'
}

function reviewTitle(line: string): string {
  if (/-defended\.json/.test(line) || /defended/.test(line)) {
    return 'Reviewer · defended'
  }
  if (/-naive\.json/.test(line) || /naive/.test(line)) {
    return 'Reviewer · open'
  }
  return 'Reviewer'
}

export function parseRunLog(log: string): ParsedRunLog {
  const phases: StreamPhase[] = []
  let current: StreamPhase | null = null

  for (const raw of log.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue

    if (HARNESS_LINE.test(line)) {
      const kind = sideFromHarness(line)
      current = startPhase(
        phases,
        kind,
        kind === 'defended' ? 'Defended' : 'Open'
      )
      continue
    }

    if (JUDGE_LINE.test(line)) {
      current = startPhase(phases, 'review', reviewTitle(line))
      continue
    }

    const match = line.match(CASE_LINE)
    if (!match) continue

    const index = Number(match[1])
    const total = Number(match[2])
    const caseId = match[3]
    const parsed = normalizeMark(match[4])
    if (!parsed) continue

    if (!current) {
      const kind: PhaseKind =
        parsed.kind === 'review' ? 'review' : 'open'
      current = startPhase(
        phases,
        kind,
        kind === 'review' ? 'Reviewer' : 'Open'
      )
    } else if (parsed.kind === 'review' && current.kind !== 'review') {
      current = startPhase(phases, 'review', 'Reviewer')
    } else if (parsed.kind === 'attack' && current.kind === 'review') {
      // A new attack arm started without a harness banner (truncated log).
      current = startPhase(phases, 'open', 'Open')
    }

    upsert(current, {
      key: `${current.id}:${caseId}`,
      caseId,
      index,
      total,
      kind: current.kind === 'review' ? 'review' : 'attack',
      mark: parsed.mark,
    })
  }

  const lastPhase = phases[phases.length - 1]
  const lastRow = lastPhase?.rows[lastPhase.rows.length - 1] ?? null
  const live =
    lastRow && lastRow.mark === 'running'
      ? lastRow
      : lastRow && lastPhase
        ? lastPhase.rows.find((r) => r.mark === 'running') ?? null
        : null

  return { phases, current: live }
}

export function phaseProgress(phase: StreamPhase): {
  done: number
  total: number
} {
  const total = phase.rows.reduce((max, row) => Math.max(max, row.total), 0)
  const done = phase.rows.filter((row) => row.mark !== 'running').length
  return { done, total: total || phase.rows.length }
}
