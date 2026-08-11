// Pair ../results/run-*.json into studies for the dashboard / API.
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export function baseName(label) {
  if (label === 'defended' || label === 'naive') return 'builtin-demo'
  if (label.endsWith('-defended')) return label.slice(0, -'-defended'.length)
  if (label.endsWith('-naive')) return label.slice(0, -'-naive'.length)
  if (label.startsWith('defended-')) return label.slice('defended-'.length)
  if (label.startsWith('naive-')) return label.slice('naive-'.length)
  return label
}

function slim(run) {
  if (!run) return run
  const { events, ...rest } = run
  void events
  return rest
}

export function loadStudies(resultsDir) {
  if (!existsSync(resultsDir)) {
    return { studies: [] }
  }

  const files = readdirSync(resultsDir).filter(
    (f) => f.startsWith('run-') && f.endsWith('.json')
  )

  const studies = new Map()

  for (const file of files) {
    const label = file.slice('run-'.length, -'.json'.length)
    const data = JSON.parse(readFileSync(join(resultsDir, file), 'utf8'))
    const summary = data.summary
    if (!summary) continue
    const records = (data.records || []).map((r) => ({
      ...r,
      run: slim(r.run),
    }))
    const base = baseName(label)
    const slot = summary.defended ? 'defended' : 'naive'

    if (!studies.has(base)) {
      studies.set(base, { name: base, naive: null, defended: null })
    }
    studies.get(base)[slot] = { label, summary, records }
  }

  return {
    studies: [...studies.values()].sort((a, b) =>
      a.name.localeCompare(b.name)
    ),
  }
}
