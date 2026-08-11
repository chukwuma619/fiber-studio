import { useEffect, useRef, useState } from "react"
import { validateHumanAmount } from "../../lib/fnn/format"
import type { AssetView, CchOrderView } from "../../lib/fnn/types"
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
import { PageErrorBanner } from "../ui/page-error-banner"
import { Text } from "../ui/text"
import { InvoiceSharePanel } from "./InvoiceSharePanel"

type ReceiveBtcDialogProps = {
  open: boolean
  onClose: () => void
  cwbtcAsset: AssetView | null
  cchConfigured: boolean
  isActing: boolean
  actionError: string | null
  onReceiveBtc: (payload: {
    amount: string
    expiryHours: number
    description?: string
  }) => Promise<CchOrderView>
  onGetCchOrder: (paymentHash: string) => Promise<CchOrderView>
  onClearError: () => void
  onSettled: () => void
}

const ORDER_POLL_INTERVAL_MS = 5_000

export function ReceiveBtcDialog({
  open,
  onClose,
  cwbtcAsset,
  cchConfigured,
  isActing,
  actionError,
  onReceiveBtc,
  onGetCchOrder,
  onClearError,
  onSettled,
}: ReceiveBtcDialogProps) {
  const [amount, setAmount] = useState("")
  const [expiryHours, setExpiryHours] = useState("24")
  const [note, setNote] = useState("")
  const [localError, setLocalError] = useState<string | null>(null)
  const [order, setOrder] = useState<CchOrderView | null>(null)
  const pollRef = useRef<number | null>(null)

  useEffect(() => {
    if (!open) {
      setAmount("")
      setExpiryHours("24")
      setNote("")
      setLocalError(null)
      setOrder(null)
      onClearError()
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [onClearError, open])

  useEffect(() => {
    if (!order || order.isFinal) {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current)
        pollRef.current = null
      }
      return
    }

    pollRef.current = window.setInterval(() => {
      void onGetCchOrder(order.paymentHash)
        .then((next) => {
          setOrder(next)
          if (next.isFinal) {
            onSettled()
          }
        })
        .catch(() => {
          // Keep showing the last known order; transient hub errors are OK.
        })
    }, ORDER_POLL_INTERVAL_MS)

    return () => {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [onGetCchOrder, onSettled, order])

  const handleCreate = async () => {
    setLocalError(null)
    onClearError()

    if (!cchConfigured) {
      setLocalError("Configure a CCH hub RPC URL in Settings first.")
      return
    }
    if (!cwbtcAsset) {
      setLocalError("cWBTC is not available on this node.")
      return
    }

    const trimmedAmount = amount.trim()
    const amountError = validateHumanAmount(trimmedAmount, cwbtcAsset.decimals)
    if (amountError) {
      setLocalError(amountError)
      return
    }

    const parsedExpiry = Number(expiryHours.trim())
    if (!Number.isInteger(parsedExpiry) || parsedExpiry < 6) {
      setLocalError("Expiry must be at least 6 hours for CCH time-lock safety.")
      return
    }

    try {
      const created = await onReceiveBtc({
        amount: trimmedAmount,
        expiryHours: parsedExpiry,
        description: note.trim() || undefined,
      })
      setOrder(created)
      onSettled()
    } catch {
      // actionError set by hook
    }
  }

  const displayError = localError ?? actionError

  return (
    <Dialog open={open} onClose={onClose} size="lg">
      <DialogTitle>Receive BTC</DialogTitle>
      <DialogDescription>
        Create a cWBTC Fiber invoice and ask a Lightning payer to fund the CCH
        hub. The hub atomically delivers wrapped BTC to you.
      </DialogDescription>
      <DialogBody>
        {displayError ? <PageErrorBanner message={displayError} /> : null}

        {!order ? (
          <FieldGroup className="mt-2">
            <Field>
              <Label>Amount ({cwbtcAsset?.symbol ?? "cWBTC"})</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00010000"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                disabled={isActing}
              />
              <Description>
                Denominated in wrapped BTC (8 decimals). 0.00010000 = 10,000 sats.
              </Description>
            </Field>
            <Field>
              <Label>Expiry (hours)</Label>
              <Input
                type="number"
                min={6}
                value={expiryHours}
                onChange={(event) => setExpiryHours(event.target.value)}
                disabled={isActing}
              />
            </Field>
            <Field>
              <Label>Note (optional)</Label>
              <Input
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                disabled={isActing}
              />
            </Field>
          </FieldGroup>
        ) : (
          <div className="mt-2 space-y-4">
            <div className="rounded-lg bg-zinc-50 px-4 py-3 text-sm dark:bg-zinc-800/50">
              <Text>
                Status: <span className="font-medium">{order.status}</span>
              </Text>
              <Text className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Amount {order.amountDisplay} · Hub fee {order.feeDisplay}
              </Text>
              {order.failureReason ? (
                <Text className="mt-2 text-xs text-red-600 dark:text-red-400">
                  {order.failureReason}
                </Text>
              ) : null}
            </div>
            <InvoiceSharePanel
              invoiceAddress={order.incomingInvoice}
              assetSymbol="BTC Lightning"
              subtitle="Share this Lightning invoice with the payer"
            />
          </div>
        )}
      </DialogBody>
      <DialogActions>
        <Button plain onClick={onClose}>
          {order?.isFinal ? "Close" : "Cancel"}
        </Button>
        {!order ? (
          <Button onClick={() => void handleCreate()} disabled={isActing}>
            {isActing ? "Creating…" : "Create Lightning invoice"}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  )
}
