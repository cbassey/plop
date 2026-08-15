import { PrimaryButton, Button } from '@cbassey/ui-kit'
import { Glossary } from '@/components/Glossary'
import { prettyCategory } from '@/lib/format'

const STEPS = [
  {
    label: 'Pick what to test',
    detail: 'A system prompt, a live agent, or the built-in demo.',
  },
  {
    label: 'Plop runs the attack suite',
    detail: 'Once open, with no defenses. Once defended, with defenses on.',
  },
  {
    label: 'Read the score',
    detail: 'How many attacks the agent held, broken down by attack type.',
  },
]

const PATHS = [
  {
    title: 'Score my prompt',
    detail:
      "Paste a system prompt. Plop runs its own agent loop and tools. This tests the prompt and model — not your product's real tools. Offline by default; live scoring needs your own API key.",
  },
  {
    title: 'Score a live agent',
    detail:
      'Point plop at your running agent, over HTTP or a shell command. Attacks hit your real tools and loop.',
  },
  {
    title: 'Try the demo',
    detail:
      "Run plop's sample agent, offline. See what a score looks like before you test something real.",
  },
]

const ATTACKS = [
  {
    key: 'direct_injection',
    detail:
      'Instructions hidden in the input, telling the agent to ignore its rules or reveal secrets.',
  },
  {
    key: 'indirect_injection',
    detail:
      'Instructions hidden inside a tool result — a doc, a file, a search hit — that the agent reads.',
  },
  {
    key: 'malformed_response',
    detail:
      'A tool returns broken or missing data. The agent should say so, not make something up.',
  },
  {
    key: 'infinite_loop',
    detail: 'A prompt tries to trick the agent into calling a tool over and over.',
  },
  {
    key: 'scope_escalation',
    detail: 'A read-only task tries to sneak in a write.',
  },
  {
    key: 'schema_smuggling',
    detail:
      'A dangerous value — a file path, a URL — hidden inside a normal-looking field.',
  },
]

export function HomeView({
  onNew,
  onSeeRuns,
}: {
  onNew: () => void
  onSeeRuns: () => void
}) {
  return (
    <div className="space-y-12">
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Attack your agent on purpose.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground sm:text-base">
          Plop throws prompt injections, jailbreaks, bad tool data, and other
          tricks at your AI agent — then scores what happens. Run the same
          attacks with your defenses off, then on, and see how much they
          help.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <PrimaryButton onClick={onNew}>New run</PrimaryButton>
          <Button type="button" variant="outline" onClick={onSeeRuns}>
            See past runs
          </Button>
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg font-medium text-foreground">
          How it works
        </h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li
              key={step.label}
              className="rounded-2xl border border-border bg-card/50 px-5 py-4"
            >
              <p className="text-xs font-medium text-muted-foreground">
                Step {i + 1}
              </p>
              <p className="mt-1 text-[14px] font-medium text-foreground">
                {step.label}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                {step.detail}
              </p>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <h2 className="font-display text-lg font-medium text-foreground">
          Three ways to test
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {PATHS.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-border bg-card/50 px-5 py-4"
            >
              <p className="text-[14px] font-medium text-foreground">
                {p.title}
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                {p.detail}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg font-medium text-foreground">
          The six attacks
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ATTACKS.map((a) => (
            <div
              key={a.key}
              className="rounded-2xl border border-border bg-card/50 px-5 py-4"
            >
              <p className="text-[14px] font-medium text-foreground">
                {prettyCategory(a.key)}
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                {a.detail}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg font-medium text-foreground">
          Terms
        </h2>
        <Glossary className="mt-4" />
      </div>
    </div>
  )
}
