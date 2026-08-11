#!/usr/bin/env node
/** Start the harness API and the Vite UI together. */
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const uiRoot = join(here, '..')

const kids = []

function start(cmd, args, name) {
  const child = spawn(cmd, args, {
    cwd: uiRoot,
    stdio: 'inherit',
    env: process.env,
  })
  child.on('exit', (code, signal) => {
    if (signal) return
    console.log(`[${name}] exited ${code}`)
    for (const k of kids) {
      if (k !== child) k.kill('SIGTERM')
    }
    process.exit(code ?? 1)
  })
  kids.push(child)
  return child
}

start(process.execPath, [join(uiRoot, 'server', 'api.mjs')], 'api')
start(process.execPath, [join(uiRoot, 'node_modules', 'vite', 'bin', 'vite.js')], 'ui')

function shutdown() {
  for (const k of kids) k.kill('SIGTERM')
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
