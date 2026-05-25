import { Button } from "@/components/ui/button"

interface ApiErrorProps {
  message: string
  onRetry?: () => void
}

export function ApiError({ message, onRetry }: ApiErrorProps) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <p>{message}</p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          className="mt-2 border-destructive/30 text-destructive hover:bg-destructive/10"
          onClick={onRetry}
        >
          Try again
        </Button>
      )}
    </div>
  )
}
