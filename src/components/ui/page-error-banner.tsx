import clsx from "clsx"
import { useEffect, useState } from "react"
import { Button } from "./button"

type PageErrorBannerProps = {
  message: string
  onRetry?: () => void
  retryLabel?: string
  onDismiss?: () => void
  dismissLabel?: string
  className?: string
}

export function PageErrorBanner({
  message,
  onRetry,
  retryLabel = "Retry",
  onDismiss,
  dismissLabel = "Dismiss",
  className,
}: PageErrorBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setDismissed(false)
  }, [message])

  if (dismissed) {
    return null
  }

  function handleDismiss() {
    onDismiss?.()
    setDismissed(true)
  }

  return (
    <div
      role="alert"
      className={clsx(
        "flex flex-wrap items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300",
        className,
      )}
    >
      <p className="min-w-0 flex-1 text-pretty">{message}</p>
      <div className="flex shrink-0 items-center gap-2">
        {onRetry ? (
          <Button outline className="text-xs" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : null}
        <Button plain className="text-xs" onClick={handleDismiss}>
          {dismissLabel}
        </Button>
      </div>
    </div>
  )
}
