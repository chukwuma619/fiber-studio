import { useEffect, useState } from "react"
import { invoiceStatusTone } from "../../lib/fnn/format"
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
    <Dialog open={open} onClose={handleClose} size="lg">
      <DialogTitle>Invoice details</DialogTitle>
      <DialogDescription>
        Invoices you create are stored locally — FNN has no list-invoices API.
      </DialogDescription>
      <DialogBody>
        {invoice ? (
          <div className="space-y-6">
            <DescriptionList>
              <DescriptionTerm>Amount</DescriptionTerm>
              <DescriptionDetails className="tabular-nums font-medium">
                {invoice.amountCkb}
              </DescriptionDetails>

              <DescriptionTerm>Note</DescriptionTerm>
              <DescriptionDetails>{invoice.note}</DescriptionDetails>

              <DescriptionTerm>Status</DescriptionTerm>
              <DescriptionDetails>
                <Badge color={invoiceStatusTone(invoice.status)}>
                  <StatusDot tone={invoiceStatusDotTone(invoice.status)} />
                  {invoice.status}
                </Badge>
              </DescriptionDetails>

              <DescriptionTerm>Expires</DescriptionTerm>
              <DescriptionDetails>
                {invoice.expiresIn ?? "—"}
              </DescriptionDetails>

              <DescriptionTerm>Payment hash</DescriptionTerm>
              <DescriptionDetails className="flex items-center gap-2 font-mono text-xs">
                <span className="min-w-0 truncate">{invoice.paymentHash}</span>
                <CopyButton value={invoice.paymentHash} />
              </DescriptionDetails>

              <DescriptionTerm>Invoice string</DescriptionTerm>
              <DescriptionDetails>
                <div className="flex items-start gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-md bg-zinc-100 px-3 py-2 font-mono text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {invoice.invoiceAddress}
                  </code>
                  <CopyButton value={invoice.invoiceAddress} />
                </div>
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
