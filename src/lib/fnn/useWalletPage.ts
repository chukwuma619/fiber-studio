import { useCallback, useEffect, useState } from "react"
import { getWalletPage } from "./invoke"
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
  const [data, setData] = useState<WalletPageResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      setIsRefreshing(true)
    }

    try {
      const response = await getWalletPage()
      setData(response)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [running])

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

  return { data, isLoading, isRefreshing, error, refresh: refreshNow }
}
