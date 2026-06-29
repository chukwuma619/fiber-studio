import { useCallback, useEffect, useState } from "react"
import { getHomeDashboard } from "./invoke"
import type { HomeDashboardResponse } from "./types"

export function useHomeDashboard(running: boolean, pollIntervalMs = 10_000) {
  const [dashboard, setDashboard] = useState<HomeDashboardResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!running) {
      setDashboard({
        available: false,
        nodeInfo: null,
        channels: [],
        peers: [],
        payments: [],
        incomingInvoices: [],
        activeChannelCount: 0,
        pendingChannelCount: 0,
        totalLocalBalance: "0",
        savedPeerPubkeys: [],
        network: null,
        relayStatus: "not_configured",
      })
      setError(null)
      setIsLoading(false)
      return
    }

    try {
      const data = await getHomeDashboard()
      setDashboard(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }, [running])

  useEffect(() => {
    setIsLoading(true)
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!running || pollIntervalMs <= 0) {
      return
    }

    const interval = window.setInterval(() => {
      void refresh()
    }, pollIntervalMs)

    return () => {
      window.clearInterval(interval)
    }
  }, [pollIntervalMs, refresh, running])

  return { dashboard, isLoading, error, refresh }
}
