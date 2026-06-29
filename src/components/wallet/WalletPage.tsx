import { RefreshCw } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNodeControlContext } from "../layout/NodeControlProvider"
import { StatusDot } from "../layout/StatusDot"
import {
  invoiceStatusTone,
  invoiceCurrencyLabel,
  invoiceStatusDisplayLabel,
  truncateLockScriptArgs,
  filterInvoices,
  type InvoiceListFilter,
} from "../../lib/fnn/format"
import { useWalletActions } from "../../lib/fnn/useWalletActions"
import { useWalletPage } from "../../lib/fnn/useWalletPage"
import { loadMoreWalletPayments } from "../../lib/fnn/invoke"
import type { WalletInvoiceItem, WalletPaymentItem } from "../../lib/fnn/types"
import { truncatePubkey } from "../../lib/public-relays"
import { HomeEmptyState } from "../home/HomeEmptyState"
import { StatCard } from "../home/StatCard"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { CopyButton } from "../ui/copy-button"
import { Heading, Subheading } from "../ui/heading"
import { Text } from "../ui/text"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table"
import { CreateInvoiceDialog } from "./CreateInvoiceDialog"
import { ImportInvoiceDialog } from "./ImportInvoiceDialog"
import { InvoiceDetailDialog } from "./InvoiceDetailDialog"
import { SendPaymentPanel } from "./SendPaymentPanel"
import { SentPaymentsSection } from "./SentPaymentsSection"

export type WalletInitialAction = "create-invoice" | "send"

type WalletPageProps = {
  initialAction?: WalletInitialAction
}

function invoiceStatusDotTone(
  status: string,
): "running" | "warning" | "danger" | "info" {
  switch (status) {
    case "Open":
    case "Paid":
      return "running"
    case "Received":
      return "warning"
    case "Expired":
    case "Cancelled":
      return "info"
    default:
      return "info"
  }
}

export function WalletPage({ initialAction }: WalletPageProps) {
  const { running } = useNodeControlContext()
  const { data, isLoading, isRefreshing, error, refresh } = useWalletPage(running)
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
  } = useWalletActions(refresh)

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

  const available = data?.available ?? false
  const invoices = data?.invoices ?? []
  const sendTargets = data?.sendTargets ?? []
  const invoiceCurrency = invoiceCurrencyLabel(data?.network)
  const receivedInvoiceCount = invoices.filter((item) => item.status === "Received").length
  const filteredInvoices = filterInvoices(invoices, invoiceFilter)

  useEffect(() => {
    if (!data) return
    setPayments(data.payments)
    setPaymentsCursor(data.paymentsLastCursor)
    setPaymentsHasMore(data.paymentsHasMore)
  }, [data])

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
    } finally {
      setIsLoadingMorePayments(false)
    }
  }, [isLoadingMorePayments, paymentsCursor])

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
          onClick={() => void refresh()}
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
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          Failed to load wallet: {error}
        </div>
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
        <section className="rounded-lg bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
          <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <div>
              <Subheading level={3}>Receive & invoices</Subheading>
              <Text className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Invoices you create to receive CKB over Fiber.
              </Text>
            </div>
            <div className="flex gap-2">
              <Button
                outline
                className="text-xs"
                onClick={() => setImportDialogOpen(true)}
                disabled={!running}
              >
                Import
              </Button>
              <Button
                outline
                className="text-xs"
                onClick={() => setCreateDialogOpen(true)}
                disabled={!running}
              >
                Create invoice
              </Button>
            </div>
          </div>

          {available && invoices.length > 0 ? (
            <div className="flex gap-1 border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
              {(
                [
                  ["active", "Active"],
                  ["paid", "Paid"],
                  ["all", "All"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    invoiceFilter === value
                      ? "bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-white"
                      : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
                  }`}
                  onClick={() => setInvoiceFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          {!available ? (
            <HomeEmptyState
              title="No invoices yet"
              description="Start your node to create and manage invoices."
            />
          ) : filteredInvoices.length === 0 ? (
            <HomeEmptyState
              title={
                invoiceFilter === "active"
                  ? "No active invoices"
                  : invoiceFilter === "paid"
                    ? "No paid invoices"
                    : "No invoices yet"
              }
              description={
                invoiceFilter === "active"
                  ? `Create a ${invoiceCurrency} invoice to receive CKB over Fiber.`
                  : invoiceFilter === "paid"
                    ? "Paid invoices appear here after someone pays you."
                    : `Create a ${invoiceCurrency} invoice to receive CKB over Fiber.`
              }
              actionLabel={invoiceFilter === "paid" ? undefined : "Create invoice"}
              onAction={
                invoiceFilter === "paid" ? undefined : () => setCreateDialogOpen(true)
              }
            />
          ) : (
            <Table dense>
              <TableHead>
                <TableRow>
                  <TableHeader>Amount</TableHeader>
                  <TableHeader>Note</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Expires</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredInvoices.map((item) => (
                  <TableRow
                    key={item.paymentHash}
                    className={`cursor-pointer ${
                      item.status === "Received"
                        ? "bg-amber-50/80 hover:bg-amber-100/80 dark:bg-amber-950/25 dark:hover:bg-amber-950/40"
                        : ""
                    }`}
                    onClick={() => setSelectedInvoice(item)}
                  >
                    <TableCell className="tabular-nums font-medium">
                      {item.amountCkb}
                    </TableCell>
                    <TableCell className="text-zinc-600 dark:text-zinc-400">
                      {item.note}
                    </TableCell>
                    <TableCell>
                      <Badge color={invoiceStatusTone(item.status)}>
                        <StatusDot tone={invoiceStatusDotTone(item.status)} />
                        {invoiceStatusDisplayLabel(item.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums text-zinc-600 dark:text-zinc-400">
                      {item.expiresIn ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>

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
          onPaymentSettled={refresh}
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
