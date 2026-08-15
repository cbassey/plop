import type { ResultsFile, Study } from '@/types'
import { describeSetup } from '@/lib/format'

export type RunMode = 'conformance' | 'capability' | 'builtin'

/** One entry in a capability agent's real tool inventory. */
export type ToolSpec = { name: string; kinds: string[] }

/** The advisory judge to run after scoring. Never changes the number. */
export type JudgeKind = 'off' | 'rule' | 'anthropic'

export type RunRequest = {
  mode: RunMode
  label: string
  pair?: boolean
  defended?: boolean
  system_prompt?: string
  backend?: 'naive' | 'mock' | 'anthropic'
  model?: string
  adapter?: 'http' | 'command'
  url?: string
  command?: string
  capabilities?: string[]
  /** The agent's real tools, each mapped to the kinds it provides. Binds
   *  abstract attacks to your tool names; supersedes `capabilities`. */
  tools?: ToolSpec[]
  /** An advisory second opinion, annotated after the score is written. */
  judge?: JudgeKind
  /** Live API key — never logged; optional if already saved. */
  api_key?: string
  /** Persist api_key on this machine (default true when provided). */
  save_api_key?: boolean
}

export type SecretsStatus = {
  anthropic: {
    configured: boolean
    hint: string | null
  }
  /** 'file' — the local service can keep the key in plop/.secrets.json.
   *  'none' — the hosted service stores nothing. Send the key per run. */
  storage?: 'file' | 'none'
}

export type Job = {
  id: string
  status: 'queued' | 'running' | 'done' | 'failed'
  mode: RunMode
  label: string
  study: string | null
  error: string | null
  log: string
  createdAt: number
  startedAt: number | null
  finishedAt: number | null
}

/** Where the API lives. Empty in dev, where Vite proxies /api to uvicorn. */
const API_BASE = (import.meta.env.VITE_PLOP_API_URL || '').replace(/\/$/, '')

const SESSION_STORAGE_KEY = 'plop.session'

/** A random id that separates this browser's runs from everybody else's.
 *  It is not a login. It grants nothing, and the server checks nothing. */
function sessionId(): string {
  if (typeof localStorage === 'undefined') return 'anon'
  let id = localStorage.getItem(SESSION_STORAGE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(SESSION_STORAGE_KEY, id)
  }
  return id
}

function call(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      'X-Plop-Session': sessionId(),
      ...(init.headers || {}),
    },
  })
}

async function parse<T>(res: Response): Promise<T> {
  const data = await res.json()
  if (!res.ok) {
    throw new Error(
      (data && data.error) || `request failed (${res.status})`
    )
  }
  return data as T
}

export async function fetchResults(): Promise<ResultsFile> {
  try {
    return await parse<ResultsFile>(await call('/api/results'))
  } catch {
    const mod = await import('@/results.json')
    return mod.default as ResultsFile
  }
}

export async function startRun(body: RunRequest): Promise<Job> {
  return parse<Job>(
    await call('/api/runs', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  )
}

export async function fetchJob(id: string): Promise<Job> {
  return parse<Job>(await call(`/api/jobs/${id}`))
}

export async function deleteStudy(name: string): Promise<{
  ok: boolean
  deleted: string[]
  studies?: Study[]
}> {
  return parse(
    await call(`/api/studies/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    })
  )
}

export async function fetchSecrets(): Promise<SecretsStatus> {
  return parse<SecretsStatus>(await call('/api/secrets'))
}

export async function saveAnthropicKey(key: string): Promise<SecretsStatus> {
  return parse<SecretsStatus>(
    await call('/api/secrets', {
      method: 'PUT',
      body: JSON.stringify({ anthropic_api_key: key }),
    })
  )
}

export async function deleteAnthropicKey(): Promise<SecretsStatus> {
  return parse<SecretsStatus>(
    await call('/api/secrets/anthropic', { method: 'DELETE' })
  )
}

export function adapterLabel(study: Study): string {
  const side = study.defended ?? study.naive
  return describeSetup(side?.summary.adapter)
}

export const CAPABILITY_OPTIONS = [
  {
    id: 'reads_untrusted_content',
    label: 'Reads outside content',
    hint: 'Can pull in docs, emails, or API responses',
  },
  {
    id: 'returns_structured_record',
    label: 'Looks up records',
    hint: 'Returns JSON or structured data that might be messy',
  },
  {
    id: 'accepts_freeform_id',
    label: 'Takes free-form ids',
    hint: 'Accepts an id, path, or similar string from the user',
  },
  {
    id: 'has_write_tool',
    label: 'Can write or send',
    hint: 'Can change state — write, create, send, delete',
  },
] as const
