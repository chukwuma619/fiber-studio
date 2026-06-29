import { useEffect, useState } from "react"
import { Button } from "../ui/button"
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog"
import { Description, Field, FieldGroup, Label } from "../ui/fieldset"
import { Input } from "../ui/input"
import { Text } from "../ui/text"
import type { CreateInvoicePayload } from "../../lib/fnn/types"
import { invoiceCurrencyLabel } from "../../lib/fnn/format"
import { InvoiceSharePanel } from "./InvoiceSharePanel"

type CreateInvoiceDialogProps = {
  open: boolean
  onClose: () => void
  network: string | null
  isActing: boolean
  actionError: string | null
  onCreateInvoice: (payload: CreateInvoicePayload) => Promise<{
    invoiceAddress: string
    paymentHash: string
  }>
  onClearError: () => void
}

function currencyLabel(network: string | null): string {
  return invoiceCurrencyLabel(network)
}

export function CreateInvoiceDialog({
  open,
  onClose,
  network,
  isActing,
  actionError,
  onCreateInvoice,
  onClearError,
}: CreateInvoiceDialogProps) {
  const [amount, setAmount] = useState("")
  const [expiryHours, setExpiryHours] = useState("24")
  const [note, setNote] = useState("")
  const [invoiceAddress, setInvoiceAddress] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setAmount("")
      setExpiryHours("24")
      setNote("")
      setInvoiceAddress(null)
      setLocalError(null)
      onClearError()
    }
  }, [onClearError, open])

  const handleCreate = async () => {
    setLocalError(null)
    onClearError()

    const parsedAmount = Number(amount.trim())
    const parsedExpiry = Number(expiryHours.trim())

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setLocalError("Enter a valid amount greater than zero.")
      return
    }

    if (!Number.isInteger(parsedExpiry) || parsedExpiry < 1) {
      setLocalError("Expiry must be at least 1 hour.")
      return
    }

    try {
      const result = await onCreateInvoice({
        amount: parsedAmount,
        expiryHours: parsedExpiry,
        description: note.trim() || undefined,
      })
      setInvoiceAddress(result.invoiceAddress)
    } catch {
      // actionError is set by the hook
    }
  }

  const displayError = localError ?? actionError
  const currency = currencyLabel(network)

  return (
    <Dialog open={open} onClose={onClose} size="lg">
      <DialogTitle>Create invoice</DialogTitle>
      <DialogDescription>
        Generate a {currency} invoice to receive CKB over the Fiber network.
      </DialogDescription>
      <DialogBody>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <Label>Amount (CKB)</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                disabled={isActing || invoiceAddress !== null}
              />
            </Field>
            <Field>
              <Label>Expiry (hours)</Label>
              <Input
                type="number"
                min={1}
                value={expiryHours}
                onChange={(event) => setExpiryHours(event.target.value)}
                disabled={isActing || invoiceAddress !== null}
              />
              <Description>Invoice expires after this duration</Description>
            </Field>
          </div>

          <Field>
            <Label>Note (optional)</Label>
            <Input
              type="text"
              placeholder="Payment description"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              disabled={isActing || invoiceAddress !== null}
            />
          </Field>

          {displayError ? (
            <Text className="text-sm text-red-600 dark:text-red-400">
              {displayError}
            </Text>
          ) : null}

          {invoiceAddress ? (
            <InvoiceSharePanel
              invoiceAddress={invoiceAddress}
              currency={currency}
            />
          ) : null}
        </FieldGroup>
      </DialogBody>
      <DialogActions>
        <Button plain onClick={onClose}>
          {invoiceAddress ? "Done" : "Cancel"}
        </Button>
        {invoiceAddress ? null : (
          <Button onClick={() => void handleCreate()} disabled={isActing}>
            {isActing ? "Creating…" : "Create invoice"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
