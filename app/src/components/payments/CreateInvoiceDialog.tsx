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
import { Select } from "../ui/select"
import { PageErrorBanner } from "../ui/page-error-banner"
import type { AssetView, CreateInvoicePayload } from "../../lib/fnn/types"
import { CKB_ASSET_ID, defaultAsset } from "../../lib/fnn/assets"
import { invoiceCurrencyLabel } from "../../lib/fnn/format"
import { InvoiceSharePanel } from "./InvoiceSharePanel"

type CreateInvoiceDialogProps = {
  open: boolean
  onClose: () => void
  network: string | null
  assets: AssetView[]
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
  assets,
  isActing,
  actionError,
  onCreateInvoice,
  onClearError,
}: CreateInvoiceDialogProps) {
  const [selectedAssetId, setSelectedAssetId] = useState(CKB_ASSET_ID)
  const [amount, setAmount] = useState("")
  const [expiryHours, setExpiryHours] = useState("24")
  const [note, setNote] = useState("")
  const [invoiceAddress, setInvoiceAddress] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const catalog = assets.length > 0 ? assets : [defaultAsset([])]
  const selectedAsset =
    catalog.find((asset) => asset.id === selectedAssetId) ?? defaultAsset(catalog)

  useEffect(() => {
    if (!open) {
      setSelectedAssetId(CKB_ASSET_ID)
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
        udtTypeScript: selectedAsset.udtTypeScript ?? undefined,
      })
      setInvoiceAddress(result.invoiceAddress)
    } catch {
      // actionError is set by the hook
    }
  }

  const displayError = localError ?? actionError
  const currency = currencyLabel(network)
  const amountLabel =
    selectedAsset.id === CKB_ASSET_ID
      ? "Amount (CKB)"
      : `Amount (${selectedAsset.symbol})`

  return (
    <Dialog open={open} onClose={onClose} size="lg">
      <DialogTitle>Create invoice</DialogTitle>
      <DialogDescription>
        Generate a {currency} invoice to receive {selectedAsset.symbol} over the
        Fiber network.
      </DialogDescription>
      <DialogBody>
        <FieldGroup>
          <Field>
            <Label>Asset</Label>
            <Select
              value={selectedAssetId}
              onChange={(event) => setSelectedAssetId(event.target.value)}
              disabled={isActing || invoiceAddress !== null}
            >
              {catalog.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <Label>{amountLabel}</Label>
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
            <PageErrorBanner
              message={displayError}
              onDismiss={() => {
                setLocalError(null)
                onClearError()
              }}
            />
          ) : null}

          {invoiceAddress ? (
            <InvoiceSharePanel
              invoiceAddress={invoiceAddress}
              currency={currency}
              assetSymbol={selectedAsset.symbol}
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
