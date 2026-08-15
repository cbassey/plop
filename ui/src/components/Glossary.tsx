const TERMS = [
  {
    term: 'Open',
    meaning: 'No defenses — the agent as-is',
  },
  {
    term: 'Defended',
    meaning: 'Same attacks with defenses on',
  },
  {
    term: 'Held',
    meaning: 'Attack failed — agent stayed safe',
  },
  {
    term: 'Broke',
    meaning: 'Attack worked — agent did the bad thing',
  },
  {
    term: 'Reviewer',
    meaning: 'Second opinion. Never changes the score',
  },
] as const

export function Glossary({ className }: { className?: string }) {
  return (
    <div
      className={
        'grid gap-3 rounded-2xl border border-border bg-card/50 px-5 py-4 sm:grid-cols-2 lg:grid-cols-5 ' +
        (className ?? '')
      }
    >
      {TERMS.map((t) => (
        <div key={t.term}>
          <p className="text-[13px] font-medium text-foreground">{t.term}</p>
          <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
            {t.meaning}
          </p>
        </div>
      ))}
    </div>
  )
}
