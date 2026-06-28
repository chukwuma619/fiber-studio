import { RefreshCw } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNodeControlContext } from "../layout/NodeControlProvider"
import { StatusDot } from "../layout/StatusDot"
import {
  invoiceStatusTone,
  invoiceCurrencyLabel,
  truncateLockScriptArgs,
} from "../../lib/fnn/format"
import { useWalletActions } from "../../lib/fnn/useWalletActions"
import { useWalletPage } from "../../lib/fnn/useWalletPage"
import type { PreviewSendPaymentResult, WalletInvoiceItem } from "../../lib/fnn/types"
import { truncatePubkey } from "../../lib/public-relays"
import { HomeEmptyState } from "../home/HomeEmptyState"
import { StatCard } from "../home/StatCard"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { CopyButton } from "../ui/copy-button"
import { Description, Field, FieldGroup, Label } from "../ui/fieldset"
import { Heading, Subheading } from "../ui/heading"
import { Input } from "../ui/input"
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
import { InvoiceDetailDialog } from "./InvoiceDetailDialog"
import { PaymentRoutePreview } from "./PaymentRoutePreview"
import { SendPaymentDialog } from "./SendPaymentDialog"
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

const PREVIEW_DEBOUNCE_MS = 500

export function WalletPage({ initialAction }: WalletPageProps) {
  const { running } = useNodeControlContext()
  const { data, isLoading, isRefreshing, error, refresh } = useWalletPage(running)
  const {
    isActing,
    actionError,
    createInvoice,
    previewSendPayment,
    sendPayment,
    getPayment,
    cancelInvoice,
    clearActionError,
  } = useWalletActions(refresh)

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<WalletInvoiceItem | null>(
    null,
  )
  const [invoice, setInvoice] = useState("")
  const [routePreview, setRoutePreview] = useState<PreviewSendPaymentResult | null>(
    null,
  )
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const available = data?.available ?? false
  const invoices = data?.invoices ?? []
  const payments = data?.payments ?? []
  const invoiceCurrency = invoiceCurrencyLabel(data?.network)

  useEffect(() => {
    if (initialAction === "create-invoice") {
      setCreateDialogOpen(true)
    }
  }, [initialAction])

  useEffect(() => {
    const trimmed = invoice.trim()
    if (!trimmed || !running || !available) {
      setRoutePreview(null)
      setPreviewError(null)
      setPreviewLoading(false)
      return
    }

    setPreviewLoading(true)
    setPreviewError(null)

    const timeout = window.setTimeout(() => {
      void previewSendPayment({ invoice: trimmed })
        .then((preview) => {
          setRoutePreview(preview)
          setPreviewError(null)
        })
        .catch((err) => {
          setRoutePreview(null)
          setPreviewError(err instanceof Error ? err.message : String(err))
        })
        .finally(() => {
          setPreviewLoading(false)
        })
    }, PREVIEW_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [available, invoice, previewSendPayment, running])

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
      return `${truncateLockScriptArgs(data.lockScript.args)} · from ckb/key`
    }
    return "On-chain CKB wallet"
  }, [available, data?.lockScript, data?.onChainWalletError])

  const canReviewPayment =
    invoice.trim().length > 0 &&
    !previewLoading &&
    routePreview !== null &&
    previewError === null

  const handleReviewPayment = useCallback(() => {
    if (!canReviewPayment) return
    clearActionError()
    setSendDialogOpen(true)
  }, [canReviewPayment, clearActionError])

  const handleSendPayment = useCallback(
    async (invoiceString: string) => sendPayment({ invoice: invoiceString }),
    [sendPayment],
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

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading level={1}>Wallet</Heading>
          <Text className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Send and receive CKB off-chain via {invoiceCurrency} invoices on the
            Fiber network.
          </Text>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button outline onClick={() => setCreateDialogOpen(true)} disabled={!running}>
            Create invoice
          </Button>
          <Button
            plain
            onClick={() => void refresh()}
            disabled={!running || isRefreshing}
            aria-label="Refresh wallet"
          >
            <RefreshCw
              className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          Failed to load wallet: {error}
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
          label="On-chain (CKB wallet)"
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
              <Subheading level={3}>Invoices</Subheading>
              <Text className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Invoices you created — click a row for details
              </Text>
            </div>
            <Button
              outline
              className="text-xs"
              onClick={() => setCreateDialogOpen(true)}
              disabled={!running}
            >
              Create invoice
            </Button>
          </div>

          {!available ? (
            <HomeEmptyState
              title="No invoices yet"
              description="Start your node to create and manage invoices."
            />
          ) : invoices.length === 0 ? (
            <HomeEmptyState
              title="No invoices yet"
              description={`Create a ${invoiceCurrency} invoice to receive CKB over Fiber.`}
              actionLabel="Create invoice"
              onAction={() => setCreateDialogOpen(true)}
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
                {invoices.map((item) => (
                  <TableRow
                    key={item.paymentHash}
                    className="cursor-pointer"
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
                        {item.status}
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

        <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
          <Subheading level={3}>Send payment</Subheading>
          <Text className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Paste a {invoiceCurrency} invoice to pay off-chain via Fiber
          </Text>

          <FieldGroup className="mt-4">
            <Field>
              <Label>Invoice string</Label>
              <Input
                type="text"
                placeholder="fibt1000000001p…"
                className="font-mono text-xs"
                value={invoice}
                onChange={(event) => setInvoice(event.target.value)}
                disabled={!running}
              />
              <Description>
                Bech32m invoice ({invoiceCurrency} on{" "}
                {data?.network === "mainnet" ? "mainnet" : "testnet"})
              </Description>
            </Field>
          </FieldGroup>

          <div className="mt-4">
            <PaymentRoutePreview
              preview={routePreview}
              isLoading={previewLoading}
              error={previewError}
              compact
            />
          </div>

          <Button
            className="mt-4 w-full"
            onClick={handleReviewPayment}
            disabled={!running || !canReviewPayment}
          >
            Review payment
          </Button>
        </div>
      </div>

      <SentPaymentsSection payments={payments} available={available} />

      <section className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
        <Subheading level={3}>Your node pubkey</Subheading>
        <Text className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Node identity from node_info — used when opening channels or receiving
          payments
        </Text>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <code className="rounded-md bg-zinc-100 px-3 py-2 font-mono text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {available && data?.pubkey
              ? truncatePubkey(data.pubkey)
              : "—"}
          </code>
          {available && data?.pubkey ? (
            <CopyButton value={data.pubkey} label="Copy pubkey" />
          ) : null}
        </div>
      </section>

      <CreateInvoiceDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        network={data?.network ?? null}
        isActing={isActing}
        actionError={actionError}
        onCreateInvoice={createInvoice}
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

      <SendPaymentDialog
        open={sendDialogOpen}
        onClose={() => setSendDialogOpen(false)}
        invoice={invoice.trim()}
        preview={routePreview}
        isActing={isActing}
        actionError={actionError}
        onSendPayment={handleSendPayment}
        onGetPayment={handleGetPayment}
        onPaymentSettled={refresh}
        onClearError={clearActionError}
      />
    </div>
  )
}
