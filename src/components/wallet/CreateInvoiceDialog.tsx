import { useEffect, useState } from "react"
import { CopyButton } from "../ui/copy-button"
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
        amountCkb: parsedAmount,
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
            <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800/50">
              <Text className="text-center text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Invoice ({currency})
              </Text>
              <Text className="mt-1 text-center text-xs text-zinc-500 dark:text-zinc-400">
                Share this Bech32m string with the payer
              </Text>
              <div className="mt-4 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md bg-white px-3 py-2 font-mono text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                  {invoiceAddress}
                </code>
                <CopyButton value={invoiceAddress} />
              </div>
            </div>
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
