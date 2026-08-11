// Read plop's result files from ../results and build src/results.json.
// Run: npm run sync
import { writeResultsFile } from './build-results.mjs'

const out = writeResultsFile()
console.log(
  `wrote ${out.studies.length} studies -> src/results.json`,
  out.studies.map((s) => s.name)
)
