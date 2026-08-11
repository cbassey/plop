import type { ResultsFile, Study } from '@/types'
import { describeSetup } from '@/lib/format'

export type RunMode = 'conformance' | 'capability' | 'builtin'

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
    return await parse<ResultsFile>(await fetch('/api/results'))
  } catch {
    const mod = await import('@/results.json')
    return mod.default as ResultsFile
  }
}

export async function startRun(body: RunRequest): Promise<Job> {
  return parse<Job>(
    await fetch('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  )
}

export async function fetchJob(id: string): Promise<Job> {
  return parse<Job>(await fetch(`/api/jobs/${id}`))
}

export async function deleteStudy(name: string): Promise<{
  ok: boolean
  deleted: string[]
  studies?: Study[]
}> {
  return parse(
    await fetch(`/api/studies/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    })
  )
}

export async function fetchSecrets(): Promise<SecretsStatus> {
  return parse<SecretsStatus>(await fetch('/api/secrets'))
}

export async function saveAnthropicKey(key: string): Promise<SecretsStatus> {
  return parse<SecretsStatus>(
    await fetch('/api/secrets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anthropic_api_key: key }),
    })
  )
}

export async function deleteAnthropicKey(): Promise<SecretsStatus> {
  return parse<SecretsStatus>(
    await fetch('/api/secrets/anthropic', { method: 'DELETE' })
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
