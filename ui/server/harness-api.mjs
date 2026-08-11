// Local API for the plop dashboard. Shells out to
// `python -m plop.harness` so UI and CLI share one runner.
import { spawn } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
} from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { loadStudies } from './load-results.mjs'
import { deleteStudy } from './delete-study.mjs'
import {
  clearSecret,
  loadSecrets,
  publicSecrets,
  saveSecrets,
} from './secrets.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const uiRoot = join(here, '..')
const plopRoot = join(uiRoot, '..')
const resultsDir = join(plopRoot, 'results')
const profilesDir = join(uiRoot, '.tmp', 'profiles')
const jobs = new Map()

const CAPABILITIES = [
  'reads_untrusted_content',
  'returns_structured_record',
  'accepts_freeform_id',
  'has_write_tool',
]

function resolvePython() {
  const venv = join(plopRoot, '.venv', 'bin', 'python')
  if (existsSync(venv)) return venv
  return process.env.PLOP_PYTHON || 'python3'
}

/** Parse KEY=VALUE lines from a .env file. Does not override existing keys. */
function loadEnvFile(path, into) {
  if (!existsSync(path)) return into
  const text = readFileSync(path, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (into[key] === undefined) into[key] = value
  }
  return into
}

function harnessEnv(overrides = {}) {
  const env = { ...process.env }
  loadEnvFile(join(plopRoot, '.env'), env)
  const secrets = loadSecrets()
  if (secrets.anthropic_api_key) {
    env.ANTHROPIC_API_KEY = secrets.anthropic_api_key
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value != null && value !== '') env[key] = String(value)
  }
  return env
}

function hasAnthropicKey(extraKey) {
  if (extraKey && String(extraKey).trim()) return true
  const env = harnessEnv()
  return Boolean(env.ANTHROPIC_API_KEY && env.ANTHROPIC_API_KEY.trim())
}

function friendlyHarnessError(stderr, code) {
  const text = (stderr || '').trim()
  if (/Could not resolve authentication method|ANTHROPIC_API_KEY/i.test(text)) {
    return (
      'Live API needs an API key. Add one under Model options, ' +
      'or put ANTHROPIC_API_KEY in plop/.env.'
    )
  }
  const lines = text.split('\n').filter(Boolean)
  const tip = [...lines]
    .reverse()
    .find((l) => /Error|Exception|TypeError/.test(l))
  return tip || text.slice(-800) || `harness exited ${code}`
}

function json(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function sanitizeLabel(raw) {
  const cleaned = String(raw || 'run')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return cleaned || 'run'
}

function buildProfile(body) {
  const mode = body.mode
  if (mode === 'conformance') {
    return {
      name: sanitizeLabel(body.label),
      mode: 'conformance',
      backend: body.backend || 'naive',
      model: body.model || 'claude-sonnet-5',
      system_prompt: String(body.system_prompt || '').trim(),
    }
  }
  if (mode === 'capability') {
    const caps = Array.isArray(body.capabilities)
      ? body.capabilities.filter((c) => CAPABILITIES.includes(c))
      : []
    const profile = {
      name: sanitizeLabel(body.label),
      mode: 'capability',
      adapter: body.adapter || 'http',
      capabilities: caps,
    }
    if (profile.adapter === 'http') profile.url = body.url
    if (profile.adapter === 'command') profile.command = body.command
    return profile
  }
  return null
}

function validateBody(body) {
  const mode = body.mode
  if (!['conformance', 'capability', 'builtin'].includes(mode)) {
    return 'mode must be conformance, capability, or builtin'
  }
  if (mode === 'conformance' && !String(body.system_prompt || '').trim()) {
    return 'Paste your agent’s instructions before running.'
  }
  if (mode === 'capability') {
    const adapter = body.adapter || 'http'
    if (adapter === 'http' && !body.url) {
      return 'Add the HTTP endpoint for your agent.'
    }
    if (adapter === 'command' && !body.command) {
      return 'Add the shell command for your agent.'
    }
  }
  const wantsLive =
    (mode === 'conformance' || mode === 'builtin') &&
    (body.backend || 'naive') === 'anthropic'
  if (wantsLive && !hasAnthropicKey(body.api_key)) {
    return (
      'Live API needs an API key. Paste one under Model options ' +
      '(saved only on this machine), or use an offline model.'
    )
  }
  return null
}

function runHarness(args, onLog, envOverrides = {}) {
  return new Promise((resolve) => {
    const python = resolvePython()
    const child = spawn(python, ['-m', 'plop.harness', ...args], {
      cwd: plopRoot,
      env: harnessEnv(envOverrides),
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (buf) => {
      stdout += buf.toString()
    })
    child.stderr.on('data', (buf) => {
      const text = buf.toString()
      stderr += text
      onLog(text)
    })
    child.on('close', (code) => {
      if (code === 0) {
        onLog(`ok · ${stdout.length} bytes of summary\n`)
      } else if (stdout.trim()) {
        onLog(stdout.slice(0, 2000))
      }
      resolve({ code: code ?? 1, stdout, stderr })
    })
    child.on('error', (err) => {
      onLog(String(err))
      resolve({ code: 1, stdout, stderr: String(err) })
    })
  })
}

async function executeJob(job) {
  job.status = 'running'
  job.startedAt = Date.now()
  const log = (line) => {
    job.log += line
    if (job.log.length > 80_000) {
      job.log = job.log.slice(-60_000)
    }
  }

  try {
    const pair = job.pair !== false
    const sides = pair
      ? [
          { suffix: 'naive', defended: false },
          { suffix: 'defended', defended: true },
        ]
      : [
          {
            suffix: job.defended ? 'defended' : 'naive',
            defended: !!job.defended,
          },
        ]

    for (const side of sides) {
      const label = `${job.label}-${side.suffix}`
      log(`\n› python -m plop.harness --label ${label}${side.defended ? ' --defended' : ''}\n`)
      const args = ['--label', label]
      if (job.profilePath) {
        args.push('--profile', job.profilePath)
      } else {
        args.push('--adapter', 'builtin')
        args.push('--backend', job.backend || 'naive')
        if (job.model) args.push('--model', job.model)
      }
      if (side.defended) args.push('--defended')

      const result = await runHarness(args, log, job.envOverrides || {})
      if (result.code !== 0) {
        job.status = 'failed'
        job.error = friendlyHarnessError(result.stderr, result.code)
        job.finishedAt = Date.now()
        return
      }
    }

    job.status = 'done'
    job.study = job.label
    job.finishedAt = Date.now()
  } catch (err) {
    job.status = 'failed'
    job.error = err instanceof Error ? err.message : String(err)
    job.finishedAt = Date.now()
  } finally {
    // Never keep run-scoped secrets on the job after it finishes.
    job.envOverrides = {}
  }
}

async function handlePostRun(req, res) {
  let body
  try {
    body = await readBody(req)
  } catch {
    return json(res, 400, { error: 'invalid JSON body' })
  }

  const err = validateBody(body)
  if (err) return json(res, 400, { error: err })

  const pastedKey =
    typeof body.api_key === 'string' && body.api_key.trim()
      ? body.api_key.trim()
      : null

  if (pastedKey && body.save_api_key !== false) {
    saveSecrets({ anthropic_api_key: pastedKey })
  }

  const label = sanitizeLabel(body.label)
  const job = {
    id: randomUUID(),
    status: 'queued',
    mode: body.mode,
    label,
    pair: body.pair !== false,
    defended: !!body.defended,
    backend: body.backend || 'naive',
    model: body.model || 'claude-sonnet-5',
    profilePath: null,
    envOverrides: pastedKey ? { ANTHROPIC_API_KEY: pastedKey } : {},
    log: '',
    error: null,
    study: null,
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
  }

  if (body.mode === 'conformance' || body.mode === 'capability') {
    mkdirSync(profilesDir, { recursive: true })
    const profile = buildProfile(body)
    const path = join(profilesDir, `${label}-${job.id.slice(0, 8)}.json`)
    writeFileSync(path, JSON.stringify(profile, null, 2))
    job.profilePath = path
  }

  jobs.set(job.id, job)
  void executeJob(job)
  return json(res, 202, publicJob(job))
}

function publicJob(job) {
  return {
    id: job.id,
    status: job.status,
    mode: job.mode,
    label: job.label,
    study: job.study,
    error: job.error,
    log: job.log,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  }
}

export function harnessApiPlugin() {
  return {
    name: 'plop-harness-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''
        if (!url.startsWith('/api/')) return next()

        try {
          if (req.method === 'GET' && url === '/api/health') {
            return json(res, 200, {
              ok: true,
              python: resolvePython(),
              plopRoot,
              anthropicKey: hasAnthropicKey(),
            })
          }

          if (req.method === 'GET' && url === '/api/secrets') {
            return json(res, 200, publicSecrets())
          }

          if (req.method === 'PUT' && url === '/api/secrets') {
            const body = await readBody(req)
            const key =
              typeof body.anthropic_api_key === 'string'
                ? body.anthropic_api_key.trim()
                : ''
            if (!key) {
              return json(res, 400, { error: 'Paste an API key to save.' })
            }
            saveSecrets({ anthropic_api_key: key })
            return json(res, 200, publicSecrets())
          }

          if (
            req.method === 'DELETE' &&
            url === '/api/secrets/anthropic'
          ) {
            clearSecret('anthropic')
            return json(res, 200, publicSecrets())
          }

          if (req.method === 'GET' && url === '/api/results') {
            return json(res, 200, loadStudies(resultsDir))
          }

          if (req.method === 'GET' && url === '/api/capabilities') {
            return json(res, 200, { capabilities: CAPABILITIES })
          }

          if (req.method === 'POST' && url === '/api/runs') {
            return await handlePostRun(req, res)
          }

          const studyMatch = url.match(/^\/api\/studies\/([^/?]+)/)
          if (req.method === 'DELETE' && studyMatch) {
            const name = decodeURIComponent(studyMatch[1])
            const result = deleteStudy(resultsDir, name)
            if (!result.ok) {
              return json(res, 404, { error: result.error, deleted: [] })
            }
            return json(res, 200, {
              ok: true,
              deleted: result.deleted,
              studies: result.studies,
            })
          }

          const jobMatch = url.match(/^\/api\/jobs\/([^/?]+)/)
          if (req.method === 'GET' && jobMatch) {
            const job = jobs.get(jobMatch[1])
            if (!job) return json(res, 404, { error: 'job not found' })
            return json(res, 200, publicJob(job))
          }

          return json(res, 404, {
            error: `no route for ${req.method} ${url.split('?')[0]}`,
          })
        } catch (err) {
          return json(res, 500, {
            error: err instanceof Error ? err.message : String(err),
          })
        }
      })
    },
  }
}

// Also export for the sync script.
export { resultsDir, uiRoot }
