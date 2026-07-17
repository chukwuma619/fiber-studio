import { useCallback, useEffect, useState } from "react"
import { getErrorMessage } from "./errors"
import { getHomeDashboard } from "./invoke"
import {
  getPageCache,
  invalidatePageCaches,
  PAGE_CACHE_KEYS,
  setPageCache,
} from "./pageCache"
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
  totalRemoteBalance: "0",
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
  const [dashboard, setDashboard] = useState<HomeDashboardResponse | null>(() =>
    getPageCache<HomeDashboardResponse>(PAGE_CACHE_KEYS.home),
  )
  const [isLoading, setIsLoading] = useState(
    () => getPageCache<HomeDashboardResponse>(PAGE_CACHE_KEYS.home) === null,
  )
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const runIfIdle = usePollInFlight()

  const effectivePollIntervalMs = hasActiveHomeActivity(dashboard)
    ? ACTIVE_POLL_INTERVAL_MS
    : pollIntervalMs

  const refresh = useCallback(
    async (manual = false) => {
      if (!running) {
        invalidatePageCaches()
        setDashboard(EMPTY_RESPONSE)
        setError(null)
        setIsLoading(false)
        setIsRefreshing(false)
        return
      }

      if (manual) {
        invalidatePageCaches(PAGE_CACHE_KEYS.home)
        setIsRefreshing(true)
      } else if (getPageCache<HomeDashboardResponse>(PAGE_CACHE_KEYS.home)) {
        setIsRefreshing(true)
      }

      const executed = await runIfIdle(
        async () => {
          try {
            const data = await getHomeDashboard()
            setPageCache(PAGE_CACHE_KEYS.home, data)
            setDashboard(data)
            setError(null)
          } catch (err) {
            setError(getErrorMessage(err))
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
    const cached = getPageCache<HomeDashboardResponse>(PAGE_CACHE_KEYS.home)
    if (cached) {
      setDashboard(cached)
      setIsLoading(false)
    } else {
      setIsLoading(true)
    }
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
