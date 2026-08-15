import { useEffect, useState, type FormEvent } from 'react'
import {
  CAPABILITY_OPTIONS,
  deleteAnthropicKey,
  fetchJob,
  fetchSecrets,
  startRun,
  type Job,
  type RunMode,
  type RunRequest,
  type SecretsStatus,
} from '@/lib/api'
import {
  Field,
  GhostButton,
  PageHeader,
  PrimaryButton,
  Alert,
  AlertDescription,
  AlertTitle,
  Input,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Button,
  Badge,
} from '@cbassey/ui-kit'
import { cn } from '@/lib/utils'
import { AlertCircle } from 'lucide-react'
import { RunProgress } from '@/components/RunProgress'

type Path = 'prompt' | 'demo' | 'agent'

const PATHS: {
  id: Path
  mode: RunMode
  title: string
  blurb: string
}[] = [
  {
    id: 'prompt',
    mode: 'conformance',
    title: 'Score my prompt',
    blurb: 'System prompt only. Full suite.',
  },
  {
    id: 'demo',
    mode: 'builtin',
    title: 'Try the demo',
    blurb: 'Sample agent. Offline.',
  },
  {
    id: 'agent',
    mode: 'capability',
    title: 'Score a live agent',
    blurb: 'Your running agent + tools.',
  },
]

export function NewRunView({
  onDone,
  onCancel,
}: {
  onDone: (study: string) => void
  onCancel: () => void
}) {
  const [path, setPath] = useState<Path>('prompt')
  const [label, setLabel] = useState('my-agent')
  const [prompt, setPrompt] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [backend, setBackend] = useState<'naive' | 'mock' | 'anthropic'>('naive')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [saveApiKey, setSaveApiKey] = useState(true)
  const [replaceKey, setReplaceKey] = useState(false)
  const [secrets, setSecrets] = useState<SecretsStatus | null>(null)
  const [secretsBusy, setSecretsBusy] = useState(false)
  const [adapter, setAdapter] = useState<'http' | 'command'>('http')
  const [url, setUrl] = useState('http://localhost:3000/api/plop-adapter')
  const [command, setCommand] = useState('python3 examples/echo-agent/agent.py')
  const [caps, setCaps] = useState<string[]>([
    'reads_untrusted_content',
    'has_write_tool',
  ])
  const [tools, setTools] = useState<{ name: string; kinds: string[] }[]>([])
  const [showTools, setShowTools] = useState(false)
  const [judge, setJudge] = useState<'off' | 'rule' | 'anthropic'>('off')
  const [job, setJob] = useState<Job | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)

  const mode = PATHS.find((p) => p.id === path)!.mode
  const activePath = PATHS.find((p) => p.id === path)!
  const keyConfigured = Boolean(secrets?.anthropic.configured)
  // The hosted service keeps no key. It takes one per run and forgets it.
  const canStoreKey = secrets?.storage !== 'none'

  useEffect(() => {
    void fetchSecrets()
      .then(setSecrets)
      .catch(() => setSecrets(null))
  }, [])

  useEffect(() => {
    if (!job || (job.status !== 'queued' && job.status !== 'running')) {
      setElapsedSec(0)
      return
    }
    const started = job.startedAt || job.createdAt || Date.now()
    const tick = () =>
      setElapsedSec(Math.max(0, Math.floor((Date.now() - started) / 1000)))
    tick()
    const t = window.setInterval(tick, 1000)
    return () => window.clearInterval(t)
  }, [job])

  useEffect(() => {
    if (!job || (job.status !== 'queued' && job.status !== 'running')) return
    const t = window.setInterval(async () => {
      try {
        const next = await fetchJob(job.id)
        setJob(next)
        if (next.status === 'done' && next.study) {
          setBusy(false)
          onDone(next.study)
        }
        if (next.status === 'failed') {
          setBusy(false)
          setError(next.error || 'Run failed')
        }
      } catch (err) {
        setBusy(false)
        setError(err instanceof Error ? err.message : String(err))
      }
    }, 900)
    return () => window.clearInterval(t)
  }, [job, onDone])

  function selectPath(next: Path) {
    setPath(next)
    setError(null)
    setShowAdvanced(false)
    if (next === 'demo') {
      setLabel((prev) => (prev === 'my-agent' || !prev ? 'demo' : prev))
      setBackend('naive')
    }
    if (next === 'prompt' && label === 'demo') setLabel('my-agent')
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (path === 'prompt' && !prompt.trim()) {
      setError('Paste a system prompt before running.')
      return
    }
    if (path === 'prompt' && backend === 'anthropic' && !model.trim()) {
      setError('Add a model id before running Live API.')
      return
    }
    if (
      path === 'prompt' &&
      backend === 'anthropic' &&
      !keyConfigured &&
      !apiKey.trim()
    ) {
      setError('Add an API key under Model options for Live API.')
      return
    }
    if (
      path === 'prompt' &&
      backend === 'anthropic' &&
      replaceKey &&
      !apiKey.trim()
    ) {
      setError('Paste the new API key, or cancel replace.')
      return
    }
    const namedTools = tools
      .map((t) => ({ name: t.name.trim(), kinds: t.kinds }))
      .filter((t) => t.name)
    const toolSignal = namedTools.some((t) => t.kinds.length > 0)
    if (path === 'agent') {
      if (adapter === 'http' && !url.trim()) {
        setError('Add the HTTP endpoint for your agent.')
        return
      }
      if (adapter === 'command' && !command.trim()) {
        setError('Add the shell command for your agent.')
        return
      }
      if (caps.length === 0 && !toolSignal) {
        setError(
          'Pick a capability or add a tool with a kind, or attacks will all skip.'
        )
        return
      }
    }
    if (judge === 'anthropic' && !keyConfigured && !apiKey.trim()) {
      setError(
        'The live judge needs an API key. Add one on “Score my prompt” → Model options, or pick the offline judge.'
      )
      return
    }

    setBusy(true)
    setJob(null)

    const effectiveBackend = path === 'demo' ? 'naive' : backend

    const body: RunRequest = {
      mode,
      label: label.trim() || (path === 'demo' ? 'demo' : 'my-agent'),
      pair: true,
      backend: effectiveBackend,
      model: model.trim() || undefined,
    }
    if (mode === 'conformance') body.system_prompt = prompt
    if (effectiveBackend === 'anthropic') {
      const pasted = apiKey.trim()
      if (pasted) {
        body.api_key = pasted
        body.save_api_key = canStoreKey && saveApiKey
      }
    }
    if (mode === 'capability') {
      body.adapter = adapter
      body.capabilities = caps
      if (namedTools.length) body.tools = namedTools
      if (adapter === 'http') body.url = url
      if (adapter === 'command') body.command = command
    }
    if (judge !== 'off') body.judge = judge

    try {
      const started = await startRun(body)
      setJob(started)
      setApiKey('')
      setReplaceKey(false)
      if (pastedKeyWillSave(body)) {
        const next = await fetchSecrets().catch(() => null)
        if (next) setSecrets(next)
      }
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  function pastedKeyWillSave(body: RunRequest) {
    return Boolean(body.api_key && body.save_api_key !== false)
  }

  async function handleRemoveKey() {
    setSecretsBusy(true)
    setError(null)
    try {
      const next = await deleteAnthropicKey()
      setSecrets(next)
      setApiKey('')
      setReplaceKey(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSecretsBusy(false)
    }
  }

  function toggleCap(id: string) {
    setCaps((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  function addTool() {
    setTools((prev) => [...prev, { name: '', kinds: [] }])
  }

  function removeTool(idx: number) {
    setTools((prev) => prev.filter((_, i) => i !== idx))
  }

  function setToolName(idx: number, name: string) {
    setTools((prev) => prev.map((t, i) => (i === idx ? { ...t, name } : t)))
  }

  function toggleToolKind(idx: number, kind: string) {
    setTools((prev) =>
      prev.map((t, i) =>
        i === idx
          ? {
              ...t,
              kinds: t.kinds.includes(kind)
                ? t.kinds.filter((k) => k !== kind)
                : [...t.kinds, kind],
            }
          : t
      )
    )
  }

  return (
    <div>
      <PageHeader
        title="New run"
        description="Pick a path. Same attack suite — open, then defended."
        action={
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {PATHS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => selectPath(p.id)}
            className={cn(
              'rounded-md border px-4 py-3 text-left transition-colors',
              path === p.id
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-transparent text-foreground hover:border-foreground/40'
            )}
          >
            <span className="block text-[13px] font-medium">{p.title}</span>
            <span
              className={cn(
                'mt-0.5 block text-[12px]',
                path === p.id ? 'text-background/70' : 'text-muted-foreground'
              )}
            >
              {p.blurb}
            </span>
          </button>
        ))}
      </div>

      <form
        onSubmit={submit}
        className="mx-auto flex min-h-[34rem] w-full max-w-2xl flex-col rounded-xl border border-border bg-card/40 p-6 sm:p-8"
      >
        <div className="mb-6 min-h-[3.25rem]">
          <p className="text-[15px] font-medium text-foreground">
            {activePath.title}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            {path === 'prompt'
              ? 'Paste the system prompt. plop supplies tools and defenses — not your product’s real agent.'
              : path === 'demo'
                ? 'Offline sample agent. Finishes in seconds. No API key.'
                : 'Attack a running agent over HTTP or a command. Only attacks your tools can receive are scored.'}
          </p>
        </div>

        <div className="flex min-h-[22rem] flex-1 flex-col gap-6 pb-8">
          {path === 'prompt' && (
            <>
              <Field label="Name" hint="shown in runs" htmlFor="run-name">
                <Input
                  id="run-name"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  required
                  placeholder="quill"
                  className="h-10 bg-background"
                />
              </Field>
              <Field label="System prompt" htmlFor="system-prompt">
                <Textarea
                  id="system-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  required
                  placeholder="Paste the system prompt your product uses…"
                  className="min-h-[180px] bg-background font-mono text-[13px] leading-relaxed"
                  autoFocus
                />
              </Field>
              <Button
                type="button"
                variant="link"
                className="h-auto self-start px-0 text-muted-foreground"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {showAdvanced ? 'Hide model options' : 'Model options'}
              </Button>
              {showAdvanced && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Model source">
                    <Select
                      value={backend}
                      onValueChange={(v) => {
                        const next = v as typeof backend
                        setBackend(next)
                        if (next === 'anthropic') setShowAdvanced(true)
                      }}
                    >
                      <SelectTrigger className="h-10 bg-background">
                        <SelectValue placeholder="Pick a model source" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="naive">
                          Offline · always obeys attacks
                        </SelectItem>
                        <SelectItem value="mock">
                          Offline · always refuses
                        </SelectItem>
                        <SelectItem value="anthropic">Live API</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field
                    label="Model id"
                    hint={
                      backend === 'anthropic' ? 'required for live' : 'optional'
                    }
                    htmlFor="model-id"
                  >
                    <Input
                      id="model-id"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      disabled={backend !== 'anthropic'}
                      placeholder="e.g. provider/model-name"
                      className="h-10 bg-background"
                    />
                  </Field>
                  {backend === 'anthropic' && (
                    <div className="space-y-4 sm:col-span-2">
                      <div className="rounded-md border border-border bg-background/50 p-4">
                        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-[13px] font-medium text-foreground">
                              API key
                            </p>
                            <p className="mt-1 text-[12px] text-muted-foreground">
                              {canStoreKey ? (
                                <>
                                  Saved on this machine in{' '}
                                  <code className="text-[11px]">
                                    .secrets.json
                                  </code>
                                  . Never shown in full after save. Not
                                  committed.
                                </>
                              ) : (
                                <>
                                  Your key, your budget. It is used for this
                                  run and then dropped. Nothing writes it to
                                  disk, and nothing logs it.
                                </>
                              )}
                            </p>
                          </div>
                          {keyConfigured && !replaceKey && (
                            <Badge variant="outline">Sensitive</Badge>
                          )}
                        </div>

                        {keyConfigured && !replaceKey ? (
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-mono text-[13px] text-foreground">
                                {secrets?.anthropic.hint}
                              </p>
                              <p className="mt-1 text-[12px] text-muted-foreground">
                                Configured · used for Live API runs
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={secretsBusy}
                                onClick={() => {
                                  setReplaceKey(true)
                                  setApiKey('')
                                }}
                              >
                                Replace
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={secretsBusy}
                                onClick={() => void handleRemoveKey()}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <Field label="Secret value" htmlFor="api-key">
                              <Input
                                id="api-key"
                                type="password"
                                autoComplete="off"
                                spellCheck={false}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Paste API key"
                                className="h-10 bg-background font-mono text-[13px]"
                              />
                            </Field>
                            {canStoreKey && (
                              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
                                <input
                                  type="checkbox"
                                  checked={saveApiKey}
                                  onChange={(e) =>
                                    setSaveApiKey(e.target.checked)
                                  }
                                  className="h-3.5 w-3.5 rounded-sm border-border"
                                />
                                Save for future runs on this machine
                              </label>
                            )}
                            {replaceKey && (
                              <Button
                                type="button"
                                variant="link"
                                className="h-auto px-0 text-muted-foreground"
                                onClick={() => {
                                  setReplaceKey(false)
                                  setApiKey('')
                                }}
                              >
                                Keep current key
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                      <p className="text-[12px] leading-relaxed text-muted-foreground">
                        Live walks every attack twice (~40 calls) and can take
                        several minutes — progress shows below.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {path === 'demo' && (
            <>
              <p className="text-[14px] leading-relaxed text-muted-foreground">
                Always offline. No model picker — just learn how scoring looks.
              </p>
              <Field label="Name" htmlFor="demo-name">
                <Input
                  id="demo-name"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  required
                  className="h-10 bg-background"
                />
              </Field>
            </>
          )}

          {path === 'agent' && (
            <>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Capability mode</AlertTitle>
                <AlertDescription>
                  plop hits <strong>your</strong> running agent. You need an
                  HTTP or command adapter. Only a system prompt?{' '}
                  <button
                    type="button"
                    className="underline underline-offset-2"
                    onClick={() => selectPath('prompt')}
                  >
                    Score my prompt
                  </button>{' '}
                  instead.
                </AlertDescription>
              </Alert>
              <Field label="Name" htmlFor="agent-name">
                <Input
                  id="agent-name"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  required
                  className="h-10 bg-background"
                />
              </Field>
              <Field label="How should plop reach your agent?">
                <Select
                  value={adapter}
                  onValueChange={(v) => setAdapter(v as typeof adapter)}
                >
                  <SelectTrigger className="h-10 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP endpoint</SelectItem>
                    <SelectItem value="command">Shell command</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {adapter === 'http' ? (
                <Field label="Endpoint URL" htmlFor="agent-url">
                  <Input
                    id="agent-url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                    className="h-10 bg-background"
                  />
                </Field>
              ) : (
                <Field label="Command" htmlFor="agent-cmd">
                  <Input
                    id="agent-cmd"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    required
                    className="h-10 bg-background font-mono text-[13px]"
                  />
                </Field>
              )}
              <div className="space-y-3">
                <div>
                  <p className="text-[13px] text-foreground">
                    What can your agent do?
                  </p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    Unchecked kinds skip those attacks — never counted as a
                    pass.
                  </p>
                </div>
                <div className="space-y-2">
                  {CAPABILITY_OPTIONS.map((c) => {
                    const on = caps.includes(c.id)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCap(c.id)}
                        className={cn(
                          'flex w-full items-start gap-3 rounded-md border px-3 py-3 text-left transition-colors',
                          on
                            ? 'border-foreground/35 bg-foreground/[0.04]'
                            : 'border-border hover:border-foreground/20'
                        )}
                      >
                        <span
                          className={cn(
                            'mt-0.5 grid h-4 w-4 place-items-center rounded-sm border text-[10px]',
                            on
                              ? 'border-foreground bg-foreground text-background'
                              : 'border-border text-transparent'
                          )}
                        >
                          ✓
                        </span>
                        <span>
                          <span className="block text-[13px] text-foreground">
                            {c.label}
                          </span>
                          <span className="mt-0.5 block text-[12px] text-muted-foreground">
                            {c.hint}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  type="button"
                  variant="link"
                  className="h-auto self-start px-0 text-muted-foreground"
                  onClick={() => setShowTools((v) => !v)}
                >
                  {showTools
                    ? 'Hide tool list'
                    : 'List individual tools (precise)'}
                </Button>
                {showTools && (
                  <div className="space-y-3">
                    <p className="text-[12px] leading-relaxed text-muted-foreground">
                      Name each tool and mark what it does. This binds attacks to
                      your real tool names — a “coerce a write” case then forbids
                      your write tools by name. Supersedes the checkboxes above.
                    </p>
                    {tools.map((t, i) => (
                      <div
                        key={i}
                        className="space-y-3 rounded-md border border-border p-3"
                      >
                        <div className="flex items-center gap-2">
                          <Input
                            value={t.name}
                            onChange={(e) => setToolName(i, e.target.value)}
                            placeholder="create_invoice"
                            className="h-9 bg-background font-mono text-[13px]"
                          />
                          <Button
                            type="button"
                            variant="link"
                            className="h-auto px-0 text-muted-foreground"
                            onClick={() => removeTool(i)}
                          >
                            Remove
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {CAPABILITY_OPTIONS.map((c) => {
                            const on = t.kinds.includes(c.id)
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => toggleToolKind(i, c.id)}
                                className={cn(
                                  'rounded-md border px-2.5 py-1 text-[12px] transition-colors',
                                  on
                                    ? 'border-foreground bg-foreground text-background'
                                    : 'border-border text-muted-foreground hover:border-foreground/30'
                                )}
                              >
                                {c.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addTool}
                    >
                      Add tool
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

          <Field
            label="Advisory judge"
            hint="never changes the score"
            htmlFor="judge-kind"
          >
            <Select value={judge} onValueChange={(v) => setJudge(v as typeof judge)}>
              <SelectTrigger id="judge-kind" className="h-10 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Off</SelectItem>
                <SelectItem value="rule">
                  Offline · narrates each verdict
                </SelectItem>
                <SelectItem value="anthropic">
                  Live model · a real second opinion
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Couldn’t start</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {job && (job.status === 'queued' || job.status === 'running') && (
            <RunProgress
              log={job.log}
              status={job.status}
              elapsedSec={elapsedSec}
            />
          )}
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-border pt-6">
          <PrimaryButton type="submit" disabled={busy}>
            {busy
              ? 'Running…'
              : path === 'prompt'
                ? 'Score my prompt'
                : path === 'demo'
                  ? 'Run demo'
                  : 'Score live agent'}
          </PrimaryButton>
          <GhostButton onClick={onCancel} disabled={busy}>
            Back
          </GhostButton>
        </div>
      </form>
    </div>
  )
}
