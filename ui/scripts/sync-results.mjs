// Read plop's result files from ../results and build src/results.json.
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadStudies } from '../server/load-results.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const resultsDir = join(here, '..', '..', 'results')
const outFile = join(here, '..', 'src', 'results.json')

const out = loadStudies(resultsDir)

mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, JSON.stringify(out, null, 2))
console.log(
  `wrote ${out.studies.length} studies -> src/results.json`,
  out.studies.map((s) => s.name)
)
