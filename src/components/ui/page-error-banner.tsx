import { Button } from "./button"

type PageErrorBannerProps = {
  message: string
  onRetry?: () => void
  retryLabel?: string
}

export function PageErrorBanner({
  message,
  onRetry,
  retryLabel = "Retry",
}: PageErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
    >
      <p>{message}</p>
      {onRetry ? (
        <Button outline className="text-xs" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  )
}
