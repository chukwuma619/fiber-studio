import { useCallback, useState } from "react"
import { connectPeer, setConfiguredPeer } from "./invoke"
import type { ConnectPeerPayload, SetConfiguredPeerPayload } from "./types"

export function useNetworkActions(onSuccess?: () => void) {
  const [isActing, setIsActing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const handleConnectPeer = useCallback(
    async (payload: ConnectPeerPayload) => {
      setIsActing(true)
      setActionError(null)
      try {
        const result = await connectPeer(payload)
        if (result.status === "failed") {
          throw new Error(
            "Could not connect to peer. Check the pubkey and network, then try again.",
          )
        }
        onSuccess?.()
        return result
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setActionError(message)
        throw error
      } finally {
        setIsActing(false)
      }
    },
    [onSuccess],
  )

  const handleSetConfiguredPeer = useCallback(
    async (payload: SetConfiguredPeerPayload) => {
      setIsActing(true)
      setActionError(null)
      try {
        const result = await setConfiguredPeer(payload)
        if (result.status === "failed") {
          throw new Error(
            "Could not connect to peer. Check the pubkey and network, then try again.",
          )
        }
        onSuccess?.()
        return result
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setActionError(message)
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
    handleConnectPeer,
    handleSetConfiguredPeer,
    clearActionError,
  }
}
