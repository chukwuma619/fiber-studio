import { useEffect, useState } from "react"
import { invoiceStatusTone, invoiceStatusDisplayLabel, invoiceStatusDescription } from "../../lib/fnn/format"
import type { WalletInvoiceItem } from "../../lib/fnn/types"
import { StatusDot } from "../layout/StatusDot"
import { Badge } from "../ui/badge"
import { CopyButton } from "../ui/copy-button"
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
} from "../ui/description-list"
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog"
import { Button } from "../ui/button"
import { Text } from "../ui/text"
import { InvoiceQrCode } from "./InvoiceQrCode"

type InvoiceDetailDialogProps = {
  open: boolean
  invoice: WalletInvoiceItem | null
  onClose: () => void
  isActing: boolean
  actionError: string | null
  onCancelInvoice: (paymentHash: string) => Promise<void>
  onClearError: () => void
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

function CopyableValue({
  value,
  copyLabel,
}: {
  value: string
  copyLabel?: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <code
        className="min-w-0 flex-1 truncate rounded-md bg-zinc-100 px-3 py-2 font-mono text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        title={value}
      >
        {value}
      </code>
      <CopyButton value={value} label={copyLabel} className="shrink-0" />
    </div>
  )
}

function isPayableInvoiceStatus(status: string): boolean {
  return status === "Open" || status === "Received"
}

export function InvoiceDetailDialog({
  open,
  invoice,
  onClose,
  isActing,
  actionError,
  onCancelInvoice,
  onClearError,
}: InvoiceDetailDialogProps) {
  const [confirmCancel, setConfirmCancel] = useState(false)

  useEffect(() => {
    if (!open) {
      setConfirmCancel(false)
      onClearError()
    }
  }, [onClearError, open])

  const handleClose = () => {
    setConfirmCancel(false)
    onClearError()
    onClose()
  }

  const handleCancel = async () => {
    if (!invoice) return
    await onCancelInvoice(invoice.paymentHash)
    handleClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} size="xl">
      <DialogTitle>Invoice details</DialogTitle>
      <DialogDescription>
        Details for invoices you created in Fiber Studio.
      </DialogDescription>
      <DialogBody>
        {invoice ? (
          <div className="space-y-6">
            {isPayableInvoiceStatus(invoice.status) ? (
              <div className="flex flex-col items-center gap-2 rounded-lg bg-zinc-50 px-4 py-5 dark:bg-zinc-800/50">
                <InvoiceQrCode value={invoice.invoiceAddress} />
                <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                  Scan to pay this invoice
                </Text>
              </div>
            ) : null}

            {invoice.status === "Received" ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
                <Text className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  Payment incoming
                </Text>
                <Text className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                  A payer has started paying this invoice. Fiber is settling the
                  off-chain payment — refresh or wait for status to change to
                  Paid.
                </Text>
              </div>
            ) : null}

            <DescriptionList className="sm:grid-cols-[min(40%,9rem)_minmax(0,1fr)]">
              <DescriptionTerm>Amount</DescriptionTerm>
              <DescriptionDetails className="min-w-0 tabular-nums font-medium">
                {invoice.amountCkb}
              </DescriptionDetails>

              <DescriptionTerm>Note</DescriptionTerm>
              <DescriptionDetails className="min-w-0 break-words">
                {invoice.note}
              </DescriptionDetails>

              <DescriptionTerm>Status</DescriptionTerm>
              <DescriptionDetails className="min-w-0">
                <Badge color={invoiceStatusTone(invoice.status)}>
                  <StatusDot tone={invoiceStatusDotTone(invoice.status)} />
                  {invoiceStatusDisplayLabel(invoice.status)}
                </Badge>
                {invoiceStatusDescription(invoice.status) ? (
                  <Text className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {invoiceStatusDescription(invoice.status)}
                  </Text>
                ) : null}
              </DescriptionDetails>

              <DescriptionTerm>Expires</DescriptionTerm>
              <DescriptionDetails className="min-w-0">
                {invoice.expiresIn ?? "—"}
              </DescriptionDetails>

              <DescriptionTerm>Payment hash</DescriptionTerm>
              <DescriptionDetails className="min-w-0">
                <CopyableValue
                  value={invoice.paymentHash}
                  copyLabel="Copy payment hash"
                />
              </DescriptionDetails>

              <DescriptionTerm>Invoice string</DescriptionTerm>
              <DescriptionDetails className="min-w-0">
                <CopyableValue
                  value={invoice.invoiceAddress}
                  copyLabel="Copy invoice"
                />
              </DescriptionDetails>
            </DescriptionList>

            {actionError ? (
              <Text className="text-sm text-red-600 dark:text-red-400">
                {actionError}
              </Text>
            ) : null}

            {confirmCancel ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
                <Text className="text-sm text-amber-900 dark:text-amber-200">
                  Cancel this open invoice? It can no longer be paid after
                  cancellation.
                </Text>
                <div className="mt-3 flex gap-2">
                  <Button
                    outline
                    className="text-xs"
                    onClick={() => setConfirmCancel(false)}
                    disabled={isActing}
                  >
                    Keep invoice
                  </Button>
                  <Button
                    className="text-xs"
                    onClick={() => void handleCancel()}
                    disabled={isActing}
                  >
                    {isActing ? "Cancelling…" : "Confirm cancel"}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogBody>
      <DialogActions>
        <Button plain onClick={handleClose}>
          Close
        </Button>
        {invoice?.status === "Open" && !confirmCancel ? (
          <Button
            outline
            onClick={() => setConfirmCancel(true)}
            disabled={isActing}
          >
            Cancel invoice
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  )
}
