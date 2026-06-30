import { useCallback, useEffect, useState } from "react"
import { getHomeDashboard } from "./invoke"
import { usePollInFlight } from "./usePollInFlight"
import type { HomeDashboardResponse } from "./types"

const EMPTY_RESPONSE: HomeDashboardResponse = {
  available: false,
  nodeInfo: null,
  channels: [],
  payments: [],
  incomingInvoices: [],
  activeChannelCount: 0,
  pendingChannelCount: 0,
  totalLocalBalance: "0",
  savedPeerPubkeys: [],
  network: null,
  relayStatus: "not_configured",
}

const DEFAULT_POLL_INTERVAL_MS = 10_000
const ACTIVE_POLL_INTERVAL_MS = 3_000

function hasPendingPayments(payments: HomeDashboardResponse["payments"]): boolean {
  return payments.some(
    (payment) => payment.status === "Created" || payment.status === "Inflight",
  )
}

function hasIncomingInvoices(
  invoices: HomeDashboardResponse["incomingInvoices"],
): boolean {
  return invoices.some((invoice) => invoice.status === "Received")
}

function hasActiveHomeActivity(dashboard: HomeDashboardResponse | null): boolean {
  if (!dashboard) return false
  return (
    dashboard.pendingChannelCount > 0 ||
    hasPendingPayments(dashboard.payments) ||
    hasIncomingInvoices(dashboard.incomingInvoices)
  )
}

export function useHomeDashboard(
  running: boolean,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
) {
  const [dashboard, setDashboard] = useState<HomeDashboardResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const runIfIdle = usePollInFlight()

  const effectivePollIntervalMs = hasActiveHomeActivity(dashboard)
    ? ACTIVE_POLL_INTERVAL_MS
    : pollIntervalMs

  const refresh = useCallback(
    async (manual = false) => {
      if (!running) {
        setDashboard(EMPTY_RESPONSE)
        setError(null)
        setIsLoading(false)
        setIsRefreshing(false)
        return
      }

      if (manual) {
        setIsRefreshing(true)
      }

      const executed = await runIfIdle(
        async () => {
          try {
            const data = await getHomeDashboard()
            setDashboard(data)
            setError(null)
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
          }
        },
        { force: manual },
      )

      if (!executed) {
        if (manual) {
          setIsRefreshing(false)
        }
        return
      }

      setIsLoading(false)
      setIsRefreshing(false)
    },
    [runIfIdle, running],
  )

  useEffect(() => {
    setIsLoading(true)
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!running || effectivePollIntervalMs <= 0) {
      return
    }

    const interval = window.setInterval(() => {
      void refresh()
    }, effectivePollIntervalMs)

    return () => {
      window.clearInterval(interval)
    }
  }, [effectivePollIntervalMs, refresh, running])

  const refreshNow = useCallback(() => refresh(true), [refresh])

  return { dashboard, isLoading, isRefreshing, error, refresh: refreshNow }
}
