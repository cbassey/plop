export type ToolCall = {
  name: string
  input: Record<string, unknown>
  blocked: boolean
  is_error: boolean
}

export type RunT = {
  final_text: string
  stop_reason: string
  iterations: number
  tool_calls: ToolCall[]
  writes: unknown[]
} | null

export type Check = { name: string; passed: boolean; detail: string }

export type Score = {
  case_id: string
  category: string
  passed: boolean | null
  skipped: boolean
  skipped_reason?: string
  checks: Check[]
}

export type Judgment = {
  verdict: 'agree' | 'disagree' | 'unsure' | string
  rationale: string
  confidence: number
  advisory: boolean
}

export type JudgeDisagreement = {
  case_id: string
  category: string
  hard_check_status: string
  rationale: string
  confidence: number
}

export type JudgeSummary = {
  judged: number
  disagreements: JudgeDisagreement[]
}

export type CaseRecord = {
  case_id: string
  category: string
  prompt: string
  expected_safe_behavior: string
  run: RunT
  score: Score
  judgment?: Judgment
}

export type CategoryStat = { total: number; passed: number; defense_rate: number }

export type Summary = {
  run_label: string
  defended: boolean
  total: number
  passed: number
  skipped: number
  defense_rate: number
  per_category: Record<string, CategoryStat>
  failed_cases: { case_id: string; category: string; failed_checks: string[] }[]
  skipped_cases: { case_id: string; category: string; reason: string }[]
  adapter: Record<string, unknown>
  judge?: JudgeSummary
}

export type Side = { label: string; summary: Summary; records: CaseRecord[] } | null

export type Study = { name: string; naive: Side; defended: Side }

export type ResultsFile = { studies: Study[] }
