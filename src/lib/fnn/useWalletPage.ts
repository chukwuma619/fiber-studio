import { useCallback, useEffect, useState } from "react"
import { getWalletPage } from "./invoke"
import {
  getPageCache,
  invalidatePageCaches,
  PAGE_CACHE_KEYS,
  setPageCache,
} from "./pageCache"
import { usePollInFlight } from "./usePollInFlight"
import type { WalletPageResponse } from "./types"

const EMPTY_RESPONSE: WalletPageResponse = {
  available: false,
  network: null,
  pubkey: null,
  inChannelBalanceCkb: 0,
  onChainWalletCkb: null,
  onChainWalletError: null,
  lockScript: null,
  invoices: [],
  payments: [],
  paymentsLastCursor: null,
  paymentsHasMore: false,
  sendTargets: [],
  relayStatus: "not_configured",
}

const DEFAULT_POLL_INTERVAL_MS = 10_000
const PENDING_PAYMENT_POLL_INTERVAL_MS = 3_000

function hasPendingPayments(payments: WalletPageResponse["payments"]): boolean {
  return payments.some(
    (payment) => payment.status === "Created" || payment.status === "Inflight",
  )
}

function hasIncomingInvoices(invoices: WalletPageResponse["invoices"]): boolean {
  return invoices.some((invoice) => invoice.status === "Received")
}

export function useWalletPage(running: boolean, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS) {
  const [data, setData] = useState<WalletPageResponse | null>(() =>
    getPageCache<WalletPageResponse>(PAGE_CACHE_KEYS.wallet),
  )
  const [isLoading, setIsLoading] = useState(
    () => getPageCache<WalletPageResponse>(PAGE_CACHE_KEYS.wallet) === null,
  )
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const runIfIdle = usePollInFlight()

  const effectivePollIntervalMs =
    data &&
    (hasPendingPayments(data.payments) || hasIncomingInvoices(data.invoices))
      ? PENDING_PAYMENT_POLL_INTERVAL_MS
      : pollIntervalMs

  const refresh = useCallback(async (manual = false) => {
    if (!running) {
      setData(EMPTY_RESPONSE)
      setError(null)
      setIsLoading(false)
      setIsRefreshing(false)
      return
    }

    if (manual) {
      invalidatePageCaches(PAGE_CACHE_KEYS.wallet, PAGE_CACHE_KEYS.home)
      setIsRefreshing(true)
    } else if (getPageCache<WalletPageResponse>(PAGE_CACHE_KEYS.wallet)) {
      setIsRefreshing(true)
    }

    const executed = await runIfIdle(
      async () => {
        try {
          const response = await getWalletPage()
          setPageCache(PAGE_CACHE_KEYS.wallet, response)
          setData(response)
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
  }, [runIfIdle, running])

  useEffect(() => {
    const cached = getPageCache<WalletPageResponse>(PAGE_CACHE_KEYS.wallet)
    if (cached) {
      setData(cached)
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

  return { data, isLoading, isRefreshing, error, refresh: refreshNow }
}
