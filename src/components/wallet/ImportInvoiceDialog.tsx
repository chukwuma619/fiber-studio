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

type ImportInvoiceDialogProps = {
  open: boolean
  onClose: () => void
  isActing: boolean
  actionError: string | null
  onImportInvoice: (paymentHash: string) => Promise<void>
  onClearError: () => void
}

export function ImportInvoiceDialog({
  open,
  onClose,
  isActing,
  actionError,
  onImportInvoice,
  onClearError,
}: ImportInvoiceDialogProps) {
  const [paymentHash, setPaymentHash] = useState("")
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setPaymentHash("")
      setLocalError(null)
      onClearError()
    }
  }, [onClearError, open])

  const handleImport = async () => {
    setLocalError(null)
    onClearError()

    const trimmed = paymentHash.trim()
    if (!trimmed) {
      setLocalError("Enter a payment hash.")
      return
    }

    try {
      await onImportInvoice(trimmed)
      onClose()
    } catch {
      // actionError is set by the hook
    }
  }

  const displayError = localError ?? actionError

  return (
    <Dialog open={open} onClose={onClose} size="md">
      <DialogTitle>Import invoice</DialogTitle>
      <DialogDescription>
        Add an invoice created outside Fiber Studio by its payment hash.
      </DialogDescription>
      <DialogBody>
        <FieldGroup>
          <Field>
            <Label>Payment hash</Label>
            <Input
              type="text"
              placeholder="0x…"
              className="font-mono text-xs"
              value={paymentHash}
              onChange={(event) => setPaymentHash(event.target.value)}
              disabled={isActing}
            />
            <Description>
              From fnn-cli, RPC, or another tool — with or without 0x prefix
            </Description>
          </Field>

          {displayError ? (
            <Text className="text-sm text-red-600 dark:text-red-400">
              {displayError}
            </Text>
          ) : null}
        </FieldGroup>
      </DialogBody>
      <DialogActions>
        <Button plain onClick={onClose} disabled={isActing}>
          Cancel
        </Button>
        <Button onClick={() => void handleImport()} disabled={isActing}>
          {isActing ? "Importing…" : "Import invoice"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
