import { useCallback, useState } from "react"
import { connectPeer, disconnectPeer, addSavedPeer, removeSavedPeer, reconnectSavedPeer } from "./invoke"
import type {
  AddSavedPeerPayload,
  ConnectPeerPayload,
  DisconnectPeerPayload,
  ReconnectSavedPeerPayload,
  RemoveSavedPeerPayload,
} from "./types"

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

  const handleAddSavedPeer = useCallback(
    async (payload: AddSavedPeerPayload) => {
      setIsActing(true)
      setActionError(null)
      try {
        const result = await addSavedPeer(payload)
        if (result.status === "failed" || result.status === "not_configured") {
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

  const handleRemoveSavedPeer = useCallback(
    async (payload: RemoveSavedPeerPayload) => {
      setIsActing(true)
      setActionError(null)
      try {
        await removeSavedPeer(payload)
        onSuccess?.()
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

  const handleReconnectSavedPeer = useCallback(
    async (payload: ReconnectSavedPeerPayload) => {
      setIsActing(true)
      setActionError(null)
      try {
        const result = await reconnectSavedPeer(payload)
        if (result.status === "failed") {
          throw new Error(
            "Could not reconnect to peer. Check that the peer is online and try again.",
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

  const handleDisconnectPeer = useCallback(
    async (payload: DisconnectPeerPayload) => {
      setIsActing(true)
      setActionError(null)
      try {
        await disconnectPeer(payload)
        onSuccess?.()
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

  return {
    isActing,
    actionError,
    handleConnectPeer,
    handleAddSavedPeer,
    handleRemoveSavedPeer,
    handleReconnectSavedPeer,
    handleDisconnectPeer,
    clearActionError,
  }
}
