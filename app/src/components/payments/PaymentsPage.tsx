import { RefreshCw } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useNodeControlContext } from "../layout/NodeControlProvider"
import { type InvoiceListFilter } from "../../lib/fnn/format"
import {
  invalidatePageCaches,
  PAGE_CACHE_KEYS,
} from "../../lib/fnn/pageCache"
import { usePaymentsActions } from "../../lib/fnn/usePaymentsActions"
import { usePaymentsPage } from "../../lib/fnn/usePaymentsPage"
import { loadMorePayments } from "../../lib/fnn/invoke"
import type { PaymentsInvoiceItem, PaymentsPaymentItem } from "../../lib/fnn/types"
import { Button } from "../ui/button"
import { Heading } from "../ui/heading"
import { PageErrorBanner } from "../ui/page-error-banner"
import { Text } from "../ui/text"
import { CreateInvoiceDialog } from "./CreateInvoiceDialog"
import { ImportInvoiceDialog } from "./ImportInvoiceDialog"
import { InvoiceDetailDialog } from "./InvoiceDetailDialog"
import { SendPaymentPanel } from "./SendPaymentPanel"
import { SentPaymentsSection } from "./SentPaymentsSection"
import { PaymentsInvoicesSection } from "./PaymentsInvoicesSection"

export type PaymentsInitialAction = "create-invoice" | "send"

type PaymentsPageProps = {
  initialAction?: PaymentsInitialAction
}

export function PaymentsPage({ initialAction }: PaymentsPageProps) {
  const { running, status } = useNodeControlContext()
  const { data, isLoading, isRefreshing, error, refresh } = usePaymentsPage(running)

  const handleMutationSuccess = useCallback(() => {
    invalidatePageCaches(PAGE_CACHE_KEYS.payments, PAGE_CACHE_KEYS.home, PAGE_CACHE_KEYS.assets)
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
  } = usePaymentsActions(handleMutationSuccess)

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceListFilter>("active")
  const [selectedInvoice, setSelectedInvoice] = useState<PaymentsInvoiceItem | null>(
    null,
  )
  const [payments, setPayments] = useState<PaymentsPaymentItem[]>([])
  const [paymentsCursor, setPaymentsCursor] = useState<string | null>(null)
  const [paymentsHasMore, setPaymentsHasMore] = useState(false)
  const [isLoadingMorePayments, setIsLoadingMorePayments] = useState(false)
  const [hasLoadedMorePayments, setHasLoadedMorePayments] = useState(false)

  const isPaymentsLoading = running && isLoading && data === null
  const available = data?.available ?? false
  const invoices = data?.invoices ?? []
  const sendTargets = data?.sendTargets ?? []
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
        updated.amountDisplay !== selectedInvoice.amountDisplay)
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
      const result = await loadMorePayments({ after: paymentsCursor })
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
    invalidatePageCaches(PAGE_CACHE_KEYS.payments, PAGE_CACHE_KEYS.home, PAGE_CACHE_KEYS.assets)
    void refresh()
  }, [refresh])

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading level={1}>Payments</Heading>
          <Text className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Send CKB and UDT off-chain via invoice, or push CKB to a known node pubkey (keysend).
          </Text>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setCreateDialogOpen(true)} disabled={!running}>
            Create invoice
          </Button>
          <Button
            outline
            onClick={() => {
              document.getElementById("send-payment-panel")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
            }}
            disabled={!running}
          >
            Send payment
          </Button>
          <Button
            outline
            onClick={handleRefresh}
            disabled={!running || isRefreshing}
            aria-label="Refresh payments"
          >
            <RefreshCw
              className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
              data-slot="icon"
            />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <PageErrorBanner
          message={`Failed to load payments: ${error}`}
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <PaymentsInvoicesSection
          status={status}
          running={running}
          available={available}
          isPaymentsLoading={isPaymentsLoading}
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
          assets={data?.assets ?? []}
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

      <CreateInvoiceDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        network={data?.network ?? null}
        assets={data?.assets ?? []}
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
