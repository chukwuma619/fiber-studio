import { useCallback, useRef } from "react"

type PollInFlightOptions = {
  /** When true, run even if a previous poll is still in flight (e.g. manual refresh). */
  force?: boolean
}

/**
 * Skips overlapping poll requests so slow backend calls do not stack.
 * Returns whether the task actually ran.
 */
export function usePollInFlight() {
  const inFlightRef = useRef(false)

  const runIfIdle = useCallback(
    async (
      task: () => Promise<void>,
      options?: PollInFlightOptions,
    ): Promise<boolean> => {
      if (inFlightRef.current && !options?.force) {
        return false
      }

      inFlightRef.current = true
      try {
        await task()
        return true
      } finally {
        inFlightRef.current = false
      }
    },
    [],
  )

  return runIfIdle
}
