import { useCallback, useEffect, useState } from "react"
import { invoiceCurrencyLabel } from "../../lib/fnn/format"
import type {
  KeysendPaymentPayload,
  ParseInvoicePreview,
  PreviewSendPaymentResult,
  SendPaymentMode,
  SendPaymentPayload,
  SendPaymentResult,
  WalletSendTarget,
} from "../../lib/fnn/types"
import { truncatePubkey } from "../../lib/public-relays"
import { Button } from "../ui/button"
import { Description, Field, FieldGroup, Label } from "../ui/fieldset"
import { Subheading } from "../ui/heading"
import { Input } from "../ui/input"
import { Select } from "../ui/select"
import { Text } from "../ui/text"
import { InvoiceParsePreview } from "./InvoiceParsePreview"
import { PaymentRoutePreview } from "./PaymentRoutePreview"
import { SendPaymentDialog } from "./SendPaymentDialog"

const PREVIEW_DEBOUNCE_MS = 500

type SendPaymentPanelProps = {
  running: boolean
  available: boolean
  network: string | null
  sendTargets: WalletSendTarget[]
  isActing: boolean
  actionError: string | null
  onParseInvoicePreview: (invoice: string) => Promise<ParseInvoicePreview>
  onPreviewSendPayment: (
    payload: SendPaymentPayload,
  ) => Promise<PreviewSendPaymentResult>
  onPreviewKeysendPayment: (
    payload: KeysendPaymentPayload,
  ) => Promise<PreviewSendPaymentResult>
  onSendPayment: (payload: SendPaymentPayload) => Promise<SendPaymentResult>
  onSendKeysendPayment: (
    payload: KeysendPaymentPayload,
  ) => Promise<SendPaymentResult>
  onGetPayment: (paymentHash: string) => Promise<SendPaymentResult>
  onPaymentSettled: () => void
  onClearError: () => void
}

export function SendPaymentPanel({
  running,
  available,
  network,
  sendTargets,
  isActing,
  actionError,
  onParseInvoicePreview,
  onPreviewSendPayment,
  onPreviewKeysendPayment,
  onSendPayment,
  onSendKeysendPayment,
  onGetPayment,
  onPaymentSettled,
  onClearError,
}: SendPaymentPanelProps) {
  const [sendMode, setSendMode] = useState<SendPaymentMode>("invoice")
  const [sendDialogOpen, setSendDialogOpen] = useState(false)

  const [invoice, setInvoice] = useState("")
  const [parsedInvoice, setParsedInvoice] = useState<ParseInvoicePreview | null>(
    null,
  )
  const [parseLoading, setParseLoading] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)

  const [targetPubkey, setTargetPubkey] = useState("")
  const [keysendAmount, setKeysendAmount] = useState("")

  const [routePreview, setRoutePreview] = useState<PreviewSendPaymentResult | null>(
    null,
  )
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const invoiceCurrency = invoiceCurrencyLabel(network)

  useEffect(() => {
    if (sendTargets.length > 0 && !targetPubkey) {
      setTargetPubkey(sendTargets[0]?.pubkey ?? "")
    }
  }, [sendTargets, targetPubkey])

  useEffect(() => {
    if (sendMode !== "invoice") {
      return
    }

    const trimmed = invoice.trim()
    if (!trimmed || !running || !available) {
      setParsedInvoice(null)
      setParseError(null)
      setParseLoading(false)
      return
    }

    setParseLoading(true)
    setParseError(null)

    const timeout = window.setTimeout(() => {
      void onParseInvoicePreview(trimmed)
        .then((preview) => {
          setParsedInvoice(preview)
          setParseError(null)
        })
        .catch((err) => {
          setParsedInvoice(null)
          setParseError(err instanceof Error ? err.message : String(err))
        })
        .finally(() => {
          setParseLoading(false)
        })
    }, PREVIEW_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [available, invoice, onParseInvoicePreview, running, sendMode])

  useEffect(() => {
    if (!running || !available) {
      setRoutePreview(null)
      setPreviewError(null)
      setPreviewLoading(false)
      return
    }

    if (sendMode === "invoice") {
      const trimmed = invoice.trim()
      if (!trimmed) {
        setRoutePreview(null)
        setPreviewError(null)
        setPreviewLoading(false)
        return
      }

      setPreviewLoading(true)
      setPreviewError(null)

      const timeout = window.setTimeout(() => {
        void onPreviewSendPayment({ invoice: trimmed })
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
    }

    const pubkey = targetPubkey.trim()
    const parsedAmount = Number(keysendAmount.trim())
    if (!pubkey || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setRoutePreview(null)
      setPreviewError(null)
      setPreviewLoading(false)
      return
    }

    setPreviewLoading(true)
    setPreviewError(null)

    const timeout = window.setTimeout(() => {
      void onPreviewKeysendPayment({
        targetPubkey: pubkey,
        amount: parsedAmount,
      })
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
  }, [
    available,
    invoice,
    keysendAmount,
    onPreviewKeysendPayment,
    onPreviewSendPayment,
    running,
    sendMode,
    targetPubkey,
  ])

  const canReviewInvoice =
    sendMode === "invoice" &&
    invoice.trim().length > 0 &&
    !parseLoading &&
    !previewLoading &&
    parsedInvoice !== null &&
    parseError === null &&
    routePreview !== null &&
    previewError === null &&
    parsedInvoice.networkMatch

  const canReviewKeysend =
    sendMode === "keysend" &&
    targetPubkey.trim().length > 0 &&
    Number(keysendAmount.trim()) > 0 &&
    !previewLoading &&
    routePreview !== null &&
    previewError === null

  const canReviewPayment = canReviewInvoice || canReviewKeysend

  const handleReviewPayment = useCallback(() => {
    if (!canReviewPayment) return
    onClearError()
    setSendDialogOpen(true)
  }, [canReviewPayment, onClearError])

  return (
    <>
      <div
        id="send-payment-panel"
        className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10"
      >
        <Subheading level={3}>Send payment</Subheading>
        <Text className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Pay by invoice or push CKB to a known node pubkey (keysend)
        </Text>

        <div className="mt-4 flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              sendMode === "invoice"
                ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-900 dark:text-white"
                : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
            }`}
            onClick={() => setSendMode("invoice")}
          >
            Invoice
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              sendMode === "keysend"
                ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-900 dark:text-white"
                : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
            }`}
            onClick={() => setSendMode("keysend")}
          >
            Keysend
          </button>
        </div>

        {sendMode === "invoice" ? (
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
                {network === "mainnet" ? "mainnet" : "testnet"})
              </Description>
            </Field>
          </FieldGroup>
        ) : (
          <FieldGroup className="mt-4">
            <Field>
              <Label>Recipient node</Label>
              {sendTargets.length > 0 ? (
                <Select
                  value={targetPubkey}
                  onChange={(event) => setTargetPubkey(event.target.value)}
                  disabled={!running}
                >
                  {sendTargets.map((target) => (
                    <option key={target.pubkey} value={target.pubkey}>
                      {target.label} · {truncatePubkey(target.pubkey)}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  type="text"
                  placeholder="02… or 03…"
                  className="font-mono text-xs"
                  value={targetPubkey}
                  onChange={(event) => setTargetPubkey(event.target.value)}
                  disabled={!running}
                />
              )}

            </Field>

            <Field>
              <Label>Amount (CKB)</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={keysendAmount}
                onChange={(event) => setKeysendAmount(event.target.value)}
                disabled={!running}
              />
            </Field>
          </FieldGroup>
        )}

        {sendMode === "invoice" ? (
          <div className="mt-4">
            <InvoiceParsePreview
              preview={parsedInvoice}
              isLoading={parseLoading}
              error={parseError}
            />
          </div>
        ) : null}

        <div className="mt-4">
          <PaymentRoutePreview
            preview={routePreview}
            isLoading={previewLoading}
            error={previewError}
            compact
            emptyHint={
              sendMode === "invoice"
                ? "Paste an invoice to preview the route"
                : "Enter recipient and amount to preview the route"
            }
          />
        </div>

        {sendMode === "invoice" &&
        parsedInvoice &&
        !parsedInvoice.networkMatch ? (
          <Text className="mt-3 text-xs text-amber-700 dark:text-amber-300">
            Fix the network mismatch before sending this invoice.
          </Text>
        ) : null}

        {sendMode === "keysend" && sendTargets.length === 0 ? (
          <Text className="mt-3 text-xs text-amber-700 dark:text-amber-300">
            No known peers yet — connect to your relay and open a channel for
            reliable keysend, or paste a pubkey manually.
          </Text>
        ) : null}

        <Button
          className="mt-4 w-full"
          onClick={handleReviewPayment}
          disabled={!running || !canReviewPayment}
        >
          Review payment
        </Button>
      </div>

      <SendPaymentDialog
        open={sendDialogOpen}
        onClose={() => setSendDialogOpen(false)}
        mode={sendMode}
        invoice={invoice.trim()}
        targetPubkey={targetPubkey.trim()}
        preview={routePreview}
        isActing={isActing}
        actionError={actionError}
        onSendPayment={onSendPayment}
        onSendKeysendPayment={onSendKeysendPayment}
        onGetPayment={onGetPayment}
        onPaymentSettled={onPaymentSettled}
        onClearError={onClearError}
        keysendPayload={
          sendMode === "keysend"
            ? {
                targetPubkey: targetPubkey.trim(),
                amount: Number(keysendAmount.trim()),
              }
            : undefined
        }
      />
    </>
  )
}
