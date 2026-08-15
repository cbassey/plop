import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

function Marker({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 border-b border-border py-2.5 last:border-b-0',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function MarkerIcon({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'mt-0.5 grid h-7 w-7 shrink-0 place-items-center text-muted-foreground',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function MarkerContent({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return <div className={cn('min-w-0 flex-1', className)}>{children}</div>
}

export { Marker, MarkerIcon, MarkerContent }
