#!/usr/bin/env node
/**
 * Local API for the plop dashboard.
 * Starts harness runs, lists profiles, and serves synced results.
 *
 *   node server/api.mjs          # :8787
 *   PLOP_API_PORT=9000 node ...
 */
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { writeResultsFile, buildResults, ROOT } from '../scripts/build-results.mjs'

const PORT = Number(process.env.PLOP_API_PORT || 8787)
const PROFILES_DIR = join(ROOT, 'profiles')
const UI_PROFILES_DIR = join(ROOT, 'profiles', '.ui')
const JOBS = new Map()

const CAPABILITIES = [
  {
    id: 'reads_untrusted_content',
    label: 'Reads untrusted content',
    hint: 'Tool returns docs, emails, or API bodies',
  },
  {
    id: 'returns_structured_record',
    label: 'Returns structured records',
    hint: 'Tool returns JSON that could be malformed',
  },
  {
    id: 'accepts_freeform_id',
    label: 'Accepts freeform IDs',
    hint: 'Tool takes a free-form id or path string',
  },
  {
    id: 'has_write_tool',
    label: 'Has a write tool',
    hint: 'Tool changes state (write, send, create)',
  },
]

function findPython() {
  const candidates = [
    join(ROOT, '.venv', 'bin', 'python'),
    join(ROOT, '.venv', 'bin', 'python3'),
    'python3',
    'python',
  ]
  for (const c of candidates) {
    if (c.includes('/') && !existsSync(c)) continue
    return c
  }
  return 'python3'
}

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(payload)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function sanitizeLabel(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return s || 'run'
}

function listProfiles() {
  if (!existsSync(PROFILES_DIR)) return []
  return readdirSync(PROFILES_DIR)
    .filter((f) => f.endsWith('.json') || f.endsWith('.yaml') || f.endsWith('.yml'))
    .filter((f) => !f.startsWith('.'))
    .map((f) => {
      const path = join(PROFILES_DIR, f)
      try {
        const data = JSON.parse(readFileSync(path, 'utf8'))
        return {
          file: f,
          path: `profiles/${f}`,
          name: data.name || f,
          mode: data.mode || 'conformance',
          backend: data.backend || null,
          adapter: data.adapter || null,
          capabilities: data.capabilities || [],
          system_prompt: data.system_prompt || '',
        }
      } catch {
        return { file: f, path: `profiles/${f}`, name: f, mode: 'unknown' }
      }
    })
}

function jobView(job) {
  return {
    id: job.id,
    status: job.status,
    label: job.label,
    mode: job.mode,
    pair: job.pair,
    steps: job.steps,
    error: job.error,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    log: job.log.slice(-200),
  }
}

function appendLog(job, line) {
  const text = String(line).replace(/\s+$/, '')
  if (!text) return
  job.log.push(text)
  if (job.log.length > 500) job.log.splice(0, job.log.length - 500)
}

function writeTempProfile(body) {
  mkdirSync(UI_PROFILES_DIR, { recursive: true })
  const name = sanitizeLabel(body.label)
  const path = join(UI_PROFILES_DIR, `${name}-${Date.now()}.json`)
  const profile = { name }

  if (body.mode === 'capability') {
    profile.mode = 'capability'
    profile.adapter = body.adapter === 'command' ? 'command' : 'http'
    if (profile.adapter === 'http') profile.url = String(body.url || '').trim()
    if (profile.adapter === 'command') {
      profile.command = String(body.command || '').trim()
    }
    profile.capabilities = Array.isArray(body.capabilities)
      ? body.capabilities
      : []
  } else {
    profile.mode = 'conformance'
    profile.system_prompt = String(body.system_prompt || '').trim()
    profile.backend = ['naive', 'mock', 'anthropic'].includes(body.backend)
      ? body.backend
      : 'naive'
    if (body.model) profile.model = String(body.model)
  }

  writeFileSync(path, JSON.stringify(profile, null, 2))
  return { path, profile }
}

function runHarness({ label, defended, profilePath, backend, adapter, url, command, model }) {
  const python = findPython()
  const args = ['-m', 'plop.harness', '--label', label]
  if (defended) args.push('--defended')

  if (profilePath) {
    args.push('--profile', profilePath)
  } else if (adapter === 'http') {
    args.push('--adapter', 'http', '--url', url)
  } else if (adapter === 'command') {
    args.push('--adapter', 'command', '--command', command)
  } else {
    args.push('--adapter', 'builtin', '--backend', backend || 'naive')
    if (model) args.push('--model', model)
  }

  return new Promise((resolve) => {
    const child = spawn(python, args, {
      cwd: ROOT,
      env: {
        ...process.env,
        PYTHONPATH: [join(ROOT, 'src'), process.env.PYTHONPATH || '']
          .filter(Boolean)
          .join(':'),
      },
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => {
      stdout += d.toString()
    })
    child.stderr.on('data', (d) => {
      stderr += d.toString()
    })
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr, args: [python, ...args] })
    })
    child.on('error', (err) => {
      resolve({
        code: 1,
        stdout,
        stderr: `${stderr}\n${err.message}`,
        args: [python, ...args],
      })
    })
  })
}

async function executeJob(job, body, profilePath) {
  job.status = 'running'
  const base = job.label

  const steps =
    body.pair === false
      ? [{ name: body.defended ? 'defended' : 'naive', defended: !!body.defended }]
      : [
          { name: 'naive', defended: false },
          { name: 'defended', defended: true },
        ]

  for (const step of steps) {
    // Always use <base>-naive / <base>-defended so UI runs never clobber
    // the committed golden labels (naive / defended).
    const label = `${base}-${step.name}`

    const stepState = {
      name: step.name,
      label,
      status: 'running',
      defense_rate: null,
      passed: null,
      total: null,
    }
    job.steps.push(stepState)
    appendLog(job, `→ ${label}${step.defended ? ' (guards on)' : ' (guards off)'}`)

    const result = await runHarness({
      label,
      defended: step.defended,
      profilePath: body.mode === 'builtin' ? null : profilePath,
      backend: body.backend,
      adapter: body.adapter,
      url: body.url,
      command: body.command,
      model: body.model,
    })

    for (const line of (result.stderr || '').split('\n')) appendLog(job, line)
    for (const line of (result.stdout || '').split('\n').slice(0, 40)) {
      appendLog(job, line)
    }

    if (result.code !== 0) {
      stepState.status = 'failed'
      job.status = 'failed'
      job.error =
        result.stderr.trim() ||
        result.stdout.trim() ||
        `harness exited with code ${result.code}`
      job.finishedAt = new Date().toISOString()
      appendLog(job, `✗ ${label} failed`)
      return
    }

    try {
      const summary = JSON.parse(result.stdout)
      stepState.status = 'done'
      stepState.defense_rate = summary.defense_rate
      stepState.passed = summary.passed
      stepState.total = summary.total
      appendLog(
        job,
        `✓ ${label} · ${summary.passed}/${summary.total} (${Math.round(summary.defense_rate * 100)}%)`
      )
    } catch {
      stepState.status = 'done'
      appendLog(job, `✓ ${label} finished`)
    }
  }

  writeResultsFile()
  job.status = 'done'
  job.finishedAt = new Date().toISOString()
  appendLog(job, 'results synced')
}

async function handlePostRun(body) {
  const mode = body.mode || 'conformance'
  if (!['conformance', 'capability', 'builtin'].includes(mode)) {
    return { status: 400, body: { error: 'mode must be conformance, capability, or builtin' } }
  }

  const label = sanitizeLabel(
    body.label || (mode === 'builtin' ? 'ui-demo' : 'ui')
  )
  let profilePath = null
  let cleanup = null

  if (mode === 'conformance') {
    if (!String(body.system_prompt || '').trim()) {
      return { status: 400, body: { error: 'conformance mode needs a system_prompt' } }
    }
    const written = writeTempProfile({ ...body, mode, label })
    profilePath = written.path
    cleanup = written.path
  } else if (mode === 'capability') {
    if (body.adapter === 'command' && !String(body.command || '').trim()) {
      return { status: 400, body: { error: 'capability command adapter needs a command' } }
    }
    if (body.adapter !== 'command' && !String(body.url || '').trim()) {
      return { status: 400, body: { error: 'capability http adapter needs a url' } }
    }
    const written = writeTempProfile({ ...body, mode, label })
    profilePath = written.path
    cleanup = written.path
  }

  const id = randomUUID().slice(0, 8)
  const job = {
    id,
    status: 'queued',
    label,
    mode,
    pair: body.pair !== false,
    steps: [],
    error: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    log: [],
    cleanup,
  }
  JOBS.set(id, job)
  appendLog(job, `job ${id} queued · mode=${mode} · label=${label}`)

  // Fire and forget; client polls.
  setTimeout(() => {
    executeJob(job, { ...body, mode, label, pair: body.pair !== false }, profilePath)
      .catch((err) => {
        job.status = 'failed'
        job.error = err.message || String(err)
        job.finishedAt = new Date().toISOString()
        appendLog(job, `✗ ${job.error}`)
      })
      .finally(() => {
        if (cleanup && existsSync(cleanup)) {
          try {
            rmSync(cleanup)
          } catch {
            /* ignore */
          }
        }
      })
  }, 0)

  return { status: 202, body: jobView(job) }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const path = url.pathname

  if (req.method === 'OPTIONS') {
    return json(res, 204, {})
  }

  try {
    if (req.method === 'GET' && path === '/api/health') {
      return json(res, 200, {
        ok: true,
        python: findPython(),
        root: ROOT,
      })
    }

    if (req.method === 'GET' && path === '/api/capabilities') {
      return json(res, 200, { capabilities: CAPABILITIES })
    }

    if (req.method === 'GET' && path === '/api/profiles') {
      return json(res, 200, { profiles: listProfiles() })
    }

    if (req.method === 'GET' && path === '/api/results') {
      const data = buildResults()
      return json(res, 200, data)
    }

    if (req.method === 'POST' && path === '/api/results/sync') {
      const data = writeResultsFile()
      return json(res, 200, data)
    }

    if (req.method === 'GET' && path === '/api/runs') {
      return json(res, 200, {
        runs: [...JOBS.values()]
          .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
          .map(jobView),
      })
    }

    if (req.method === 'GET' && path.startsWith('/api/runs/')) {
      const id = path.slice('/api/runs/'.length)
      const job = JOBS.get(id)
      if (!job) return json(res, 404, { error: 'run not found' })
      return json(res, 200, jobView(job))
    }

    if (req.method === 'POST' && path === '/api/runs') {
      const body = await readBody(req)
      const result = await handlePostRun(body)
      return json(res, result.status, result.body)
    }

    return json(res, 404, { error: 'not found' })
  } catch (err) {
    return json(res, 500, { error: err.message || String(err) })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`plop api on http://127.0.0.1:${PORT}`)
})
