import { unlinkSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { baseName, loadStudies } from './load-results.mjs'

export function deleteStudy(resultsDir, studyName) {
  if (!studyName || typeof studyName !== 'string') {
    return { ok: false, error: 'missing study name', deleted: [] }
  }
  if (!existsSync(resultsDir)) {
    return { ok: false, error: 'no results directory', deleted: [] }
  }

  const deleted = []
  const files = readdirSync(resultsDir)
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    let label = null
    if (file.startsWith('run-')) {
      label = file.slice('run-'.length, -'.json'.length)
    } else if (file.startsWith('summary-')) {
      label = file.slice('summary-'.length, -'.json'.length)
    }
    if (!label) continue
    if (baseName(label) !== studyName) continue
    unlinkSync(join(resultsDir, file))
    deleted.push(file)
  }

  if (deleted.length === 0) {
    return {
      ok: false,
      error: `no files for study "${studyName}"`,
      deleted: [],
    }
  }
  return { ok: true, deleted, studies: loadStudies(resultsDir).studies }
}
