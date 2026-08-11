const CATEGORY_LABELS: Record<string, string> = {
  direct_injection: 'Direct injection',
  indirect_injection: 'Indirect injection',
  malformed_response: 'Bad tool data',
  infinite_loop: 'Runaway loop',
  scope_escalation: 'Scope escape',
  schema_smuggling: 'Schema smuggling',
}

const CHECK_LABELS: Record<string, string> = {
  no_write: 'Did not write or change state',
  forbidden_tools: 'Did not call a forbidden tool',
  forbidden_output_substrings: 'Did not leak sensitive text',
  forbidden_system_prompt: 'Did not reveal the system prompt',
  required_output_substrings_any: 'Flagged the bad data in the answer',
  must_finish: 'Finished cleanly',
  max_iterations: 'Stayed within the turn limit',
  no_dangerous_tool_input: 'Did not pass a dangerous id or path',
}

const ADAPTER_LABELS: Record<string, string> = {
  conformance: 'Your prompt',
  builtin: 'Demo agent',
  http: 'Your agent · HTTP',
  command: 'Your agent · command',
  unknown: 'Unknown setup',
}

export function prettyCategory(key: string): string {
  if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key]
  const s = key.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function pct(rate: number): string {
  return `${Math.round(rate * 100)}`
}

export function prettyCheck(name: string): string {
  return CHECK_LABELS[name] || name.replace(/_/g, ' ')
}

/** Turn `direct-01-ignore-and-reveal` into “Ignore and reveal”. */
export function caseTitle(caseId: string): string {
  const parts = caseId.split('-')
  // drop category prefix + numeric index when present (direct-01-…)
  let rest = parts
  if (parts.length >= 3 && /^\d+$/.test(parts[1])) {
    rest = parts.slice(2)
  }
  const words = rest.join(' ').replace(/_/g, ' ').trim()
  if (!words) return caseId
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function describeSetup(adapter: Record<string, unknown> | undefined): string {
  if (!adapter) return 'Unknown setup'
  const kind = String(adapter.adapter ?? 'unknown')
  const base = ADAPTER_LABELS[kind] || kind
  const bits = [base]
  if (adapter.agent) bits.push(String(adapter.agent))
  if (adapter.model) bits.push(String(adapter.model))
  if (adapter.backend && kind === 'conformance') {
    bits.push(backendLabel(String(adapter.backend)))
  }
  return bits.join(' · ')
}

export function backendLabel(backend: string): string {
  if (backend === 'naive') return 'offline · vulnerable'
  if (backend === 'mock') return 'offline · safe stub'
  if (backend === 'anthropic') return 'live API'
  return backend
}
