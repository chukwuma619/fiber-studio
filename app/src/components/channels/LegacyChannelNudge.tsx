import { useNavigate } from "@tanstack/react-router"
import { useCallback, useState } from "react"
import { dismissLegacyChannelNudge } from "../../lib/fnn/invoke"
import { Button } from "../ui/button"

type LegacyChannelNudgeProps = {
  open: boolean
  legacyChannelCount: number
  onDismissed?: () => void
}

export function LegacyChannelNudge({
  open,
  legacyChannelCount,
  onDismissed,
}: LegacyChannelNudgeProps) {
  const navigate = useNavigate()
  const [dismissing, setDismissing] = useState(false)

  const dismiss = useCallback(async () => {
    setDismissing(true)
    try {
      await dismissLegacyChannelNudge()
      onDismissed?.()
    } catch {
      onDismissed?.()
    } finally {
      setDismissing(false)
    }
  }, [onDismissed])

  if (!open || legacyChannelCount <= 0) {
    return null
  }

  const countLabel =
    legacyChannelCount === 1
      ? "1 legacy channel"
      : `${legacyChannelCount} legacy channels`

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
      <p className="font-medium">Close legacy (V1) channels when you can</p>
      <p className="mt-1 text-amber-900/90 dark:text-amber-100/80">
        Fiber 0.10 uses Channel V2. You still have {countLabel} from before the
        upgrade — they keep working, but new opens need both peers on 0.10+.
        Close and reopen when practical; V1 support goes away in a future
        major release.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          outline
          className="text-xs"
          disabled={dismissing}
          onClick={() => {
            void navigate({ to: "/channels" })
          }}
        >
          View channels
        </Button>
        <Button
          plain
          className="text-xs"
          disabled={dismissing}
          onClick={() => void dismiss()}
        >
          Dismiss
        </Button>
      </div>
    </div>
  )
}
