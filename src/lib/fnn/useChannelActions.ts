import { useCallback, useState } from "react"
import { openChannel, shutdownChannel } from "./invoke"
import type { OpenChannelPayload, ShutdownChannelPayload } from "./types"

export function useChannelActions(onSuccess?: () => void) {
  const [isActing, setIsActing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const handleOpenChannel = useCallback(
    async (payload: OpenChannelPayload) => {
      setIsActing(true)
      setActionError(null)
      try {
        await openChannel(payload)
        onSuccess?.()
      } catch (error) {
        setActionError(error instanceof Error ? error.message : String(error))
        throw error
      } finally {
        setIsActing(false)
      }
    },
    [onSuccess],
  )

  const handleShutdownChannel = useCallback(
    async (payload: ShutdownChannelPayload) => {
      setIsActing(true)
      setActionError(null)
      try {
        await shutdownChannel(payload)
        onSuccess?.()
      } catch (error) {
        setActionError(error instanceof Error ? error.message : String(error))
        throw error
      } finally {
        setIsActing(false)
      }
    },
    [onSuccess],
  )

  const clearActionError = useCallback(() => {
    setActionError(null)
  }, [])

  return {
    isActing,
    actionError,
    handleOpenChannel,
    handleShutdownChannel,
    clearActionError,
  }
}
