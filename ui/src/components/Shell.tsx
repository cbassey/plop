import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function Shell({
  children,
  nav,
  action,
}: {
  children: ReactNode
  nav: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-5 sm:px-8">
          <span className="font-display text-[15px] font-semibold tracking-tight">
            plop
          </span>
          <nav className="flex flex-1 items-center gap-1">{nav}</nav>
          {action}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-12">
        {children}
      </main>
    </div>
  )
}

export function NavLink({
  active,
  onClick,
  children,
}: {
  active?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant={active ? 'default' : 'ghost'}
      size="sm"
      onClick={onClick}
      className={cn(!active && 'text-muted-foreground')}
    >
      {children}
    </Button>
  )
}

export function PrimaryButton({
  children,
  onClick,
  type = 'button',
  disabled,
  className,
}: {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
  className?: string
}) {
  return (
    <Button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {children}
    </Button>
  )
}

export function GhostButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {children}
    </Button>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow && (
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string
  hint?: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={htmlFor} className="text-[13px] font-normal text-foreground">
          {label}
        </Label>
        {hint && (
          <span className="text-[11px] text-muted-foreground">{hint}</span>
        )}
      </div>
      {children}
    </div>
  )
}
