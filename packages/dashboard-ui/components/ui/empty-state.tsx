interface EmptyStateProps {
  message: string
  description?: string
  illustration?: React.ReactNode
  action?: React.ReactNode
}

export function EmptyState({ message, description, illustration, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      {illustration && (
        <div className="mb-1 select-none pointer-events-none">
          {illustration}
        </div>
      )}
      <p className="text-sm font-semibold text-foreground/75">{message}</p>
      {description && (
        <p className="text-xs text-muted-foreground max-w-[260px] leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
