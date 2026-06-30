import { RefreshCw } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNodeControlContext } from "../layout/NodeControlProvider"
import {
  invoiceCurrencyLabel,
  truncateLockScriptArgs,
  type InvoiceListFilter,
} from "../../lib/fnn/format"
import {
  invalidatePageCaches,
  PAGE_CACHE_KEYS,
} from "../../lib/fnn/pageCache"
import { useWalletActions } from "../../lib/fnn/useWalletActions"
import { useWalletPage } from "../../lib/fnn/useWalletPage"
import { loadMoreWalletPayments } from "../../lib/fnn/invoke"
import type { WalletInvoiceItem, WalletPaymentItem } from "../../lib/fnn/types"
import { truncatePubkey } from "../../lib/public-relays"
import { StatCard } from "../home/StatCard"
import { Button } from "../ui/button"
import { CopyButton } from "../ui/copy-button"
import { Heading } from "../ui/heading"
import { PageErrorBanner } from "../ui/page-error-banner"
import { Text } from "../ui/text"
import { CreateInvoiceDialog } from "./CreateInvoiceDialog"
import { ImportInvoiceDialog } from "./ImportInvoiceDialog"
import { InvoiceDetailDialog } from "./InvoiceDetailDialog"
import { SendPaymentPanel } from "./SendPaymentPanel"
import { SentPaymentsSection } from "./SentPaymentsSection"
import { WalletInvoicesSection } from "./WalletInvoicesSection"

export type WalletInitialAction = "create-invoice" | "send"

type WalletPageProps = {
  initialAction?: WalletInitialAction
}

export function WalletPage({ initialAction }: WalletPageProps) {
  const { running } = useNodeControlContext()
  const { data, isLoading, isRefreshing, error, refresh } = useWalletPage(running)

  const handleMutationSuccess = useCallback(() => {
    invalidatePageCaches(PAGE_CACHE_KEYS.wallet, PAGE_CACHE_KEYS.home)
    void refresh()
  }, [refresh])

  const {
    isActing,
    actionError,
    createInvoice,
    previewSendPayment,
    parseInvoicePreview,
    previewKeysendPayment,
    sendPayment,
    sendKeysendPayment,
    getPayment,
    cancelInvoice,
    importInvoice,
    clearActionError,
  } = useWalletActions(handleMutationSuccess)

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceListFilter>("active")
  const [selectedInvoice, setSelectedInvoice] = useState<WalletInvoiceItem | null>(
    null,
  )
  const [payments, setPayments] = useState<WalletPaymentItem[]>([])
  const [paymentsCursor, setPaymentsCursor] = useState<string | null>(null)
  const [paymentsHasMore, setPaymentsHasMore] = useState(false)
  const [isLoadingMorePayments, setIsLoadingMorePayments] = useState(false)
  const [hasLoadedMorePayments, setHasLoadedMorePayments] = useState(false)

  const isWalletLoading = running && isLoading && data === null
  const available = data?.available ?? false
  const invoices = data?.invoices ?? []
  const sendTargets = data?.sendTargets ?? []
  const invoiceCurrency = invoiceCurrencyLabel(data?.network)
  const receivedInvoiceCount = invoices.filter((item) => item.status === "Received").length

  useEffect(() => {
    if (!running) {
      setHasLoadedMorePayments(false)
    }
  }, [running])

  useEffect(() => {
    if (!data) return

    setPayments((current) => {
      if (!hasLoadedMorePayments) {
        return data.payments
      }

      const firstPageHashes = new Set(
        data.payments.map((payment) => payment.paymentHash),
      )
      const extraPages = current.filter(
        (payment) => !firstPageHashes.has(payment.paymentHash),
      )

      return [...data.payments, ...extraPages]
    })

    if (!hasLoadedMorePayments) {
      setPaymentsCursor(data.paymentsLastCursor)
      setPaymentsHasMore(data.paymentsHasMore)
    }
  }, [data, hasLoadedMorePayments])

  useEffect(() => {
    if (!selectedInvoice) return
    const updated = invoices.find(
      (item) => item.paymentHash === selectedInvoice.paymentHash,
    )
    if (
      updated &&
      (updated.status !== selectedInvoice.status ||
        updated.expiresIn !== selectedInvoice.expiresIn ||
        updated.amountCkb !== selectedInvoice.amountCkb)
    ) {
      setSelectedInvoice(updated)
    }
  }, [invoices, selectedInvoice])

  useEffect(() => {
    if (initialAction === "create-invoice") {
      setCreateDialogOpen(true)
    }
    if (initialAction === "send") {
      window.requestAnimationFrame(() => {
        document.getElementById("send-payment-panel")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        })
      })
    }
  }, [initialAction])

  const inChannelBalance = available
    ? data?.inChannelBalanceCkb.toFixed(2) ?? "0"
    : "—"
  const onChainWallet = available
    ? data?.onChainWalletCkb !== null && data?.onChainWalletCkb !== undefined
      ? data.onChainWalletCkb.toFixed(2)
      : "—"
    : "—"

  const onChainSubtext = useMemo(() => {
    if (!available) return "Start node to view balance"
    if (data?.onChainWalletError) return data.onChainWalletError
    if (data?.lockScript) {
      return `${truncateLockScriptArgs(data.lockScript.args)} · L1 funding wallet (not Fiber spendable)`
    }
    return "On-chain CKB for channel funding — not spendable via Fiber invoices"
  }, [available, data?.lockScript, data?.onChainWalletError])

  const handleParseInvoicePreview = useCallback(
    (invoice: string) => parseInvoicePreview({ invoice }),
    [parseInvoicePreview],
  )

  const handleGetPayment = useCallback(
    async (paymentHash: string) => getPayment({ paymentHash }),
    [getPayment],
  )

  const handleCancelInvoice = useCallback(
    async (paymentHash: string) => {
      await cancelInvoice({ paymentHash })
    },
    [cancelInvoice],
  )

  const handleImportInvoice = useCallback(
    async (paymentHash: string) => {
      await importInvoice({ paymentHash })
    },
    [importInvoice],
  )

  const handleLoadMorePayments = useCallback(async () => {
    if (!paymentsCursor || isLoadingMorePayments) return

    setIsLoadingMorePayments(true)
    try {
      const result = await loadMoreWalletPayments({ after: paymentsCursor })
      setPayments((current) => {
        const existing = new Set(current.map((payment) => payment.paymentHash))
        const next = result.payments.filter(
          (payment) => !existing.has(payment.paymentHash),
        )
        return [...current, ...next]
      })
      setPaymentsCursor(result.lastCursor)
      setPaymentsHasMore(result.hasMore)
      setHasLoadedMorePayments(true)
    } finally {
      setIsLoadingMorePayments(false)
    }
  }, [isLoadingMorePayments, paymentsCursor])

  const handleRefresh = useCallback(() => {
    setHasLoadedMorePayments(false)
    invalidatePageCaches(PAGE_CACHE_KEYS.wallet, PAGE_CACHE_KEYS.home)
    void refresh()
  }, [refresh])

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading level={1}>Wallet</Heading>
          <Text className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Send CKB off-chain via invoice or keysend, and receive via{" "}
            {invoiceCurrency} invoices on the Fiber network.
          </Text>
        </div>
        <Button
          outline
          onClick={handleRefresh}
          disabled={!running || isRefreshing}
          aria-label="Refresh wallet"
        >
          <RefreshCw
            className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
            data-slot="icon"
          />
          Refresh
        </Button>
      </div>

      {error ? (
        <PageErrorBanner
          message={`Failed to load wallet: ${error}`}
          onRetry={handleRefresh}
        />
      ) : null}

      {available && receivedInvoiceCount > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          {receivedInvoiceCount === 1
            ? "1 invoice has an incoming payment settling."
            : `${receivedInvoiceCount} invoices have incoming payments settling.`}{" "}
          Highlighted rows in the invoice table below — status updates every few
          seconds.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="In channels"
          value={isLoading && running ? "…" : inChannelBalance}
          unit={available ? "CKB" : undefined}
          subtext={
            available
              ? "Local balance across open channels"
              : "Start node to view balance"
          }
        />
        <StatCard
          label="On-chain (funding wallet)"
          value={isLoading && running ? "…" : onChainWallet}
          unit={
            available &&
            data?.onChainWalletCkb !== null &&
            data?.onChainWalletCkb !== undefined
              ? "CKB"
              : undefined
          }
          subtext={onChainSubtext}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <WalletInvoicesSection
          running={running}
          available={available}
          isWalletLoading={isWalletLoading}
          network={data?.network ?? null}
          invoices={invoices}
          invoiceFilter={invoiceFilter}
          onInvoiceFilterChange={setInvoiceFilter}
          onSelectInvoice={setSelectedInvoice}
          onImport={() => setImportDialogOpen(true)}
          onCreate={() => setCreateDialogOpen(true)}
        />

        <SendPaymentPanel
          running={running}
          available={available}
          network={data?.network ?? null}
          relayStatus={data?.relayStatus ?? "not_configured"}
          sendTargets={sendTargets}
          isActing={isActing}
          actionError={actionError}
          onParseInvoicePreview={handleParseInvoicePreview}
          onPreviewSendPayment={previewSendPayment}
          onPreviewKeysendPayment={previewKeysendPayment}
          onSendPayment={sendPayment}
          onSendKeysendPayment={sendKeysendPayment}
          onGetPayment={handleGetPayment}
          onPaymentSettled={handleMutationSuccess}
          onClearError={clearActionError}
        />
      </div>

      <SentPaymentsSection
        payments={payments}
        available={available}
        hasMore={paymentsHasMore}
        isLoadingMore={isLoadingMorePayments}
        onLoadMore={() => void handleLoadMorePayments()}
      />

      {available && data?.pubkey ? (
        <Text className="text-xs text-zinc-500 dark:text-zinc-400">
          Node pubkey{" "}
          <code className="font-mono">{truncatePubkey(data.pubkey)}</code>
          {" · "}
          <CopyButton value={data.pubkey} label="Copy" />
        </Text>
      ) : null}

      <CreateInvoiceDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        network={data?.network ?? null}
        isActing={isActing}
        actionError={actionError}
        onCreateInvoice={createInvoice}
        onClearError={clearActionError}
      />

      <ImportInvoiceDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        isActing={isActing}
        actionError={actionError}
        onImportInvoice={handleImportInvoice}
        onClearError={clearActionError}
      />

      <InvoiceDetailDialog
        open={selectedInvoice !== null}
        invoice={selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        isActing={isActing}
        actionError={actionError}
        onCancelInvoice={handleCancelInvoice}
        onClearError={clearActionError}
      />
    </div>
  )
}
