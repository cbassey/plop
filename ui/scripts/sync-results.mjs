// Read plop's result files from ../results and build src/results.json.
// Pairs each <base>-naive / <base>-defended run into one "study" so the
// dashboard can show before/after. Run: npm run sync
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const resultsDir = join(here, '..', '..', 'results')
const outFile = join(here, '..', 'src', 'results.json')

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
  // Drop the verbose event log; the dashboard uses tool_calls/writes/text.
  const { events, ...rest } = run
  void events
  return rest
}

const files = readdirSync(resultsDir).filter(
  (f) => f.startsWith('run-') && f.endsWith('.json')
)

const studies = new Map()

for (const file of files) {
  const label = file.slice('run-'.length, -'.json'.length)
  const data = JSON.parse(readFileSync(join(resultsDir, file), 'utf8'))
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

const out = {
  studies: [...studies.values()].sort((a, b) => a.name.localeCompare(b.name)),
}

mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, JSON.stringify(out, null, 2))
console.log(
  `wrote ${out.studies.length} studies -> src/results.json`,
  out.studies.map((s) => s.name)
)
