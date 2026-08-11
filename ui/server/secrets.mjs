// Local secrets for the plop UI / harness.
// File: plop/.secrets.json (gitignored). Never returned in full over the API.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const plopRoot = join(here, '..', '..')
const secretsPath = join(plopRoot, '.secrets.json')
const legacyPath = join(here, '..', '.tmp', 'secrets.json')

function empty() {
  return { anthropic_api_key: null }
}

function readFile(path) {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function normalize(data) {
  if (!data || typeof data !== 'object') return empty()
  return {
    anthropic_api_key:
      typeof data.anthropic_api_key === 'string' &&
      data.anthropic_api_key.trim()
        ? data.anthropic_api_key.trim()
        : null,
  }
}

export function loadSecrets() {
  const primary = readFile(secretsPath)
  if (primary) return normalize(primary)

  // One-time migrate from the old ui/.tmp location.
  const legacy = readFile(legacyPath)
  if (legacy) {
    const migrated = normalize(legacy)
    if (migrated.anthropic_api_key) {
      writeFileSync(
        secretsPath,
        JSON.stringify(migrated, null, 2) + '\n',
        { mode: 0o600 }
      )
      try {
        unlinkSync(legacyPath)
      } catch {
        /* ignore */
      }
    }
    return migrated
  }

  return empty()
}

export function saveSecrets(next) {
  mkdirSync(dirname(secretsPath), { recursive: true })
  const current = loadSecrets()
  const merged = {
    anthropic_api_key:
      next.anthropic_api_key !== undefined
        ? next.anthropic_api_key
          ? String(next.anthropic_api_key).trim()
          : null
        : current.anthropic_api_key,
  }
  writeFileSync(secretsPath, JSON.stringify(merged, null, 2) + '\n', {
    mode: 0o600,
  })
  return merged
}

export function clearSecret(name) {
  const current = loadSecrets()
  if (name === 'anthropic') current.anthropic_api_key = null
  if (!current.anthropic_api_key) {
    if (existsSync(secretsPath)) unlinkSync(secretsPath)
    return empty()
  }
  return saveSecrets(current)
}

/** Mask like Vercel: keep a short prefix + last 4. */
export function maskSecret(value) {
  const v = String(value || '').trim()
  if (!v) return null
  if (v.length <= 8) return '••••••••'
  const prefix = v.slice(0, Math.min(7, v.length - 4))
  return `${prefix}…${v.slice(-4)}`
}

export function publicSecrets() {
  const s = loadSecrets()
  return {
    anthropic: {
      configured: Boolean(s.anthropic_api_key),
      hint: s.anthropic_api_key ? maskSecret(s.anthropic_api_key) : null,
    },
  }
}

export { secretsPath }
