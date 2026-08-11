import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/lib/utils'

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="font-sans text-xs text-muted-foreground/80">{hint}</span>
      ) : null}
    </label>
  )
}

export function TextInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-9 rounded-md border border-border bg-background px-3 font-sans text-sm text-foreground',
        'placeholder:text-muted-foreground/50 focus:border-signal/50 focus:outline-none focus:ring-1 focus:ring-signal/30',
        'disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

export function TextTextarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-h-[140px] rounded-md border border-border bg-background px-3 py-2 font-mono text-xs leading-relaxed text-foreground',
        'placeholder:text-muted-foreground/50 focus:border-signal/50 focus:outline-none focus:ring-1 focus:ring-signal/30',
        'disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

export function TextSelect({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-9 rounded-md border border-border bg-background px-3 font-sans text-sm text-foreground',
        'focus:border-signal/50 focus:outline-none focus:ring-1 focus:ring-signal/30',
        'disabled:opacity-50',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export function Button({
  className,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'warn'
}) {
  return (
    <button
      className={cn(
        'inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 font-mono text-[11px] uppercase tracking-[0.15em] transition-colors',
        'disabled:pointer-events-none disabled:opacity-40',
        variant === 'primary' &&
          'bg-signal text-primary-foreground hover:bg-signal/90',
        variant === 'ghost' &&
          'border border-border bg-card text-foreground hover:bg-accent',
        variant === 'warn' &&
          'bg-warn/90 text-primary-foreground hover:bg-warn',
        className
      )}
      {...props}
    />
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-sm px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] transition-colors',
            value === opt.value
              ? 'bg-signal text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
