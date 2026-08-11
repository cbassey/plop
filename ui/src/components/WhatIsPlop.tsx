import { useState } from 'react'
import { cn } from '@/lib/utils'

export function WhatIsPlop({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card/40 px-5 py-4',
        className
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div>
          <p className="text-[14px] font-medium text-foreground">
            What plop does
          </p>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            Attacks a tool-using agent with injections, jailbreaks, bad tool
            data, loops, and scope tricks — then scores how often it held.
          </p>
        </div>
        <span className="shrink-0 text-[12px] text-muted-foreground">
          {open ? 'Hide' : 'Details'}
        </span>
      </button>

      {open && (
        <div className="mt-4 space-y-4 border-t border-border pt-4 text-[13px] leading-relaxed text-muted-foreground">
          <p>
            Every run is meant to happen twice:{' '}
            <span className="text-foreground">open</span> (no defenses) then{' '}
            <span className="text-foreground">defended</span> (defenses on).
            Held = attack failed. Broke = attack worked.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-background/50 px-3.5 py-3">
              <p className="font-medium text-foreground">Score my prompt</p>
              <p className="mt-1">
                Paste the <span className="text-foreground">system prompt</span>.
                plop runs its own loop and tools. Tests prompt + model — not
                your product’s real tools.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background/50 px-3.5 py-3">
              <p className="font-medium text-foreground">Score a live agent</p>
              <p className="mt-1">
                Point at a running agent (HTTP/command). Attacks hit{' '}
                <span className="text-foreground">your</span> tools and loop.
                Missing tool kinds skip those attacks.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background/50 px-3.5 py-3">
              <p className="font-medium text-foreground">Try the demo</p>
              <p className="mt-1">
                plop’s sample agent, offline. Learn the score before you paste
                a real prompt.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
