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
import { Text } from "../ui/text"
import type {
  AssetView,
  CreateInvoicePayload,
  CreateInvoiceResult,
} from "../../lib/fnn/types"
import { CKB_ASSET_ID, defaultAsset } from "../../lib/fnn/assets"
import { invoiceCurrencyLabel, validateHumanAmount } from "../../lib/fnn/format"
import { InvoiceSharePanel } from "./InvoiceSharePanel"

type CreateInvoiceDialogProps = {
  open: boolean
  onClose: () => void
  network: string | null
  assets: AssetView[]
  hasReadyChannel: boolean
  isActing: boolean
  actionError: string | null
  onCreateInvoice: (
    payload: CreateInvoicePayload,
  ) => Promise<CreateInvoiceResult>
  onClearError: () => void
}

function currencyLabel(network: string | null): string {
  return invoiceCurrencyLabel(network)
}

function invoiceReceiveNote(result: CreateInvoiceResult): string | null {
  if (result.liquidityProvider) {
    if (result.jitOpenFeeDisplay) {
      return `No channel with you is required. The payer covers a ${result.jitOpenFeeDisplay} open fee.`
    }
    return "No channel with you is required for this invoice."
  }
  if (result.jitUnavailable) {
    return "This invoice needs a route to you. Add funds if you do not have a channel yet."
  }
  return null
}

export function CreateInvoiceDialog({
  open,
  onClose,
  network,
  assets,
  hasReadyChannel,
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
  const [jitNote, setJitNote] = useState<string | null>(null)
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
      setJitNote(null)
      setLocalError(null)
      onClearError()
    }
  }, [onClearError, open])

  const handleCreate = async () => {
    setLocalError(null)
    onClearError()

    const trimmedAmount = amount.trim()
    const amountError = validateHumanAmount(trimmedAmount, selectedAsset.decimals)
    if (amountError) {
      setLocalError(amountError)
      return
    }

    const parsedExpiry = Number(expiryHours.trim())
    if (!Number.isInteger(parsedExpiry) || parsedExpiry < 1) {
      setLocalError("Expiry must be at least 1 hour.")
      return
    }

    try {
      const result = await onCreateInvoice({
        amount: trimmedAmount,
        expiryHours: parsedExpiry,
        description: note.trim() || undefined,
        udtTypeScript: selectedAsset.udtTypeScript ?? undefined,
      })
      setInvoiceAddress(result.invoiceAddress)
      setJitNote(invoiceReceiveNote(result))
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
      <DialogTitle>Receive</DialogTitle>
      <DialogDescription>
        Create a {currency} invoice for {selectedAsset.symbol}.
      </DialogDescription>
      <DialogBody>
        <FieldGroup>
          {!hasReadyChannel && !invoiceAddress ? (
            <Text className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              You need a channel to receive. Add funds to open one with a public
              hub.
              <Button
                href="/channels?action=open"
                outline
                className="mt-2 text-xs"
              >
                Add funds
              </Button>
            </Text>
          ) : null}
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
              subtitle={
                jitNote ??
                "Scan the QR code or share the Bech32m string with the payer"
              }
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
