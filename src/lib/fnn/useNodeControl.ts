import { useCallback, useEffect, useState } from "react"
import { resolveConfiguredDataDirectory } from "../data-directory"
import { loadSetupConfig } from "../setup/storage"
import { getErrorMessage } from "./errors"
import { getNodeStatus, migrateLegacyDataDirectory, startNode, stopNode } from "./invoke"
import { isNodeRunning } from "./status"
import type { NodeStatusResponse, NodeStatusState } from "./types"

export function useNodeControl(pollIntervalMs = 5000) {
  const config = loadSetupConfig()
  const [nodeStatus, setNodeStatus] = useState<NodeStatusResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isActing, setIsActing] = useState(false)

  useEffect(() => {
    if (!config?.network) return
    void migrateLegacyDataDirectory(config.network).catch(() => {
      // Best-effort migration for legacy ~/Library/fiber-studio installs.
    })
  }, [config?.network])

  const refreshStatus = useCallback(async () => {
    try {
      const dataDirectory = await resolveConfiguredDataDirectory(config?.network)
      const status = await getNodeStatus(dataDirectory)
      setNodeStatus(status)
    } catch (error) {
      setActionError(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }, [config?.network])

  useEffect(() => {
    void refreshStatus()

    if (pollIntervalMs <= 0) {
      return
    }

    const interval = window.setInterval(() => {
      void refreshStatus()
    }, pollIntervalMs)

    return () => {
      window.clearInterval(interval)
    }
  }, [pollIntervalMs, refreshStatus])

  const handleStartNode = useCallback(async () => {
    const dataDirectory = await resolveConfiguredDataDirectory(config?.network)
    if (!dataDirectory) {
      setActionError("Data directory is not configured.")
      return
    }

    setIsActing(true)
    setActionError(null)
    try {
      const status = await startNode({ dataDirectory })
      setNodeStatus(status)
    } catch (error) {
      setActionError(getErrorMessage(error))
    } finally {
      setIsActing(false)
    }
  }, [config?.network])

  const handleStopNode = useCallback(async () => {
    setIsActing(true)
    setActionError(null)
    try {
      const status = await stopNode()
      setNodeStatus(status)
    } catch (error) {
      setActionError(getErrorMessage(error))
    } finally {
      setIsActing(false)
    }
  }, [])

  const status = nodeStatus?.status ?? null
  const running = status ? isNodeRunning(status) : false
  const stopped = status?.state === "stopped"
  const starting = status?.state === "starting"
  const errored = status?.state === "error"

  return {
    config,
    nodeStatus,
    status,
    isLoading,
    actionError,
    isActing,
    running,
    stopped,
    starting,
    errored,
    refreshStatus,
    handleStartNode,
    handleStopNode,
  }
}

export function nodeHeaderLabel(status: NodeStatusState | null, isLoading: boolean): string {
  if (isLoading || !status) {
    return "fnn loading…"
  }

  switch (status.state) {
    case "running":
      return "fnn running"
    case "stopped":
      return "fnn stopped"
    case "starting":
      return "fnn starting"
    case "error":
      return "fnn error"
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

export function nodeStatusDotTone(
  status: NodeStatusState | null,
  isLoading: boolean,
): "running" | "stopped" | "warning" | "danger" {
  if (isLoading || !status) {
    return "warning"
  }

  switch (status.state) {
    case "running":
      return "running"
    case "stopped":
      return "stopped"
    case "starting":
      return "warning"
    case "error":
      return "danger"
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

export function formatNetworkLabel(network: string | undefined): string {
  if (network === "mainnet") return "Mainnet"
  if (network === "testnet") return "Testnet"
  return network ?? "Unknown"
}
