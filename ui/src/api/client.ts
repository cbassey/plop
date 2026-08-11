/** Thin client for the local plop API (proxied in vite). */

import type { ResultsFile } from '@/types'

export type CapabilityInfo = {
  id: string
  label: string
  hint: string
}

export type ProfileInfo = {
  file: string
  path: string
  name: string
  mode: string
  backend?: string | null
  adapter?: string | null
  capabilities?: string[]
  system_prompt?: string
}

export type RunStep = {
  name: string
  label: string
  status: 'running' | 'done' | 'failed'
  defense_rate: number | null
  passed: number | null
  total: number | null
}

export type RunJob = {
  id: string
  status: 'queued' | 'running' | 'done' | 'failed'
  label: string
  mode: string
  pair: boolean
  steps: RunStep[]
  error: string | null
  startedAt: string
  finishedAt: string | null
  log: string[]
}

export type StartRunBody = {
  mode: 'conformance' | 'capability' | 'builtin'
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
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText)
  }
  return data as T
}

export const api = {
  health: () => req<{ ok: boolean; python: string }>('/api/health'),
  capabilities: () => req<{ capabilities: CapabilityInfo[] }>('/api/capabilities'),
  profiles: () => req<{ profiles: ProfileInfo[] }>('/api/profiles'),
  results: () => req<ResultsFile>('/api/results'),
  syncResults: () =>
    req<ResultsFile>('/api/results/sync', { method: 'POST' }),
  runs: () => req<{ runs: RunJob[] }>('/api/runs'),
  run: (id: string) => req<RunJob>(`/api/runs/${id}`),
  startRun: (body: StartRunBody) =>
    req<RunJob>('/api/runs', { method: 'POST', body: JSON.stringify(body) }),
}
