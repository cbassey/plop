// Shared: read ../results/run-*.json into a studies payload.
// Used by sync-results.mjs and the local API server.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
export const ROOT = join(here, '..', '..')
export const RESULTS_DIR = join(ROOT, 'results')
export const OUT_FILE = join(here, '..', 'src', 'results.json')

function baseName(label) {
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

export function buildResults() {
  if (!existsSync(RESULTS_DIR)) {
    return { studies: [] }
  }

  const files = readdirSync(RESULTS_DIR).filter(
    (f) => f.startsWith('run-') && f.endsWith('.json')
  )
  const studies = new Map()

  for (const file of files) {
    const label = file.slice('run-'.length, -'.json'.length)
    const data = JSON.parse(readFileSync(join(RESULTS_DIR, file), 'utf8'))
    const summary = data.summary
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
    studies: [...studies.values()].sort((a, b) => a.name.localeCompare(b.name)),
  }
}

export function writeResultsFile(data = buildResults()) {
  mkdirSync(dirname(OUT_FILE), { recursive: true })
  writeFileSync(OUT_FILE, JSON.stringify(data, null, 2))
  return data
}
