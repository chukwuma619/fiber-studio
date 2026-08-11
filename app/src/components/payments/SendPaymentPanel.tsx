import { useCallback, useEffect, useState } from "react"
import { getErrorMessage } from "../../lib/fnn/errors"
import {
  invoiceCurrencyLabel,
  parseExistingPaymentSession,
  paymentErrorSummary,
} from "../../lib/fnn/format"
import { relaySendPaymentWarning } from "../../lib/fnn/relay"
import type {
  AssetView,
  CchOrderView,
  KeysendPaymentPayload,
  ParseInvoicePreview,
  PreviewSendPaymentResult,
  RelayConnectionStatus,
  SendPaymentMode,
  SendPaymentPayload,
  SendPaymentResult,
  PaymentsSendTarget,
} from "../../lib/fnn/types"
import { CKB_ASSET_ID, defaultAsset, findAssetById } from "../../lib/fnn/assets"
import { truncatePubkey } from "../../lib/public-relays"
import { Button } from "../ui/button"
import { Description, Field, FieldGroup, Label } from "../ui/fieldset"
import { Subheading } from "../ui/heading"
import { Input } from "../ui/input"
import { Link } from "../ui/link"
import { PageErrorBanner } from "../ui/page-error-banner"
import { Select } from "../ui/select"
import { Text } from "../ui/text"
import { CchSendDialog } from "./CchSendDialog"
import { InvoiceParsePreview } from "./InvoiceParsePreview"
import { PaymentRoutePreview } from "./PaymentRoutePreview"
import { SendPaymentDialog } from "./SendPaymentDialog"

const PREVIEW_DEBOUNCE_MS = 500

function looksLikeBolt11(value: string): boolean {
  const trimmed = value.trim().toLowerCase()
  return (
    trimmed.startsWith("lnbc") ||
    trimmed.startsWith("lntb") ||
    trimmed.startsWith("lnbcrt") ||
    trimmed.startsWith("lnsb")
  )
}

type ExistingPaymentNotice = {
  paymentHash: string
  status: string
  message: string
}

type SendPaymentPanelProps = {
  running: boolean
  available: boolean
  network: string | null
  relayStatus: RelayConnectionStatus
  sendTargets: PaymentsSendTarget[]
  assets: AssetView[]
  cchConfigured: boolean
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
  onCchSendBtc: (btcPayReq: string) => Promise<CchOrderView>
  onGetCchOrder: (paymentHash: string) => Promise<CchOrderView>
  onPaymentSettled: () => void
  onClearError: () => void
}

export function SendPaymentPanel({
  running,
  available,
  network,
  relayStatus,
  sendTargets,
  assets,
  cchConfigured,
  isActing,
  actionError,
  onParseInvoicePreview,
  onPreviewSendPayment,
  onPreviewKeysendPayment,
  onSendPayment,
  onSendKeysendPayment,
  onGetPayment,
  onCchSendBtc,
  onGetCchOrder,
  onPaymentSettled,
  onClearError,
}: SendPaymentPanelProps) {
  const [sendMode, setSendMode] = useState<SendPaymentMode>("invoice")
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const [cchDialogOpen, setCchDialogOpen] = useState(false)

  const [invoice, setInvoice] = useState("")
  const [lightningInvoice, setLightningInvoice] = useState("")
  const [parsedInvoice, setParsedInvoice] = useState<ParseInvoicePreview | null>(
    null,
  )
  const [parseLoading, setParseLoading] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)

  const [targetPubkey, setTargetPubkey] = useState("")
  const [keysendAmount, setKeysendAmount] = useState("")
  const [keysendAssetId, setKeysendAssetId] = useState(CKB_ASSET_ID)

  const catalog = assets.length > 0 ? assets : [defaultAsset([])]
  const keysendAsset =
    findAssetById(catalog, keysendAssetId) ?? defaultAsset(catalog)

  const [routePreview, setRoutePreview] = useState<PreviewSendPaymentResult | null>(
    null,
  )
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [existingPayment, setExistingPayment] =
    useState<ExistingPaymentNotice | null>(null)
  const [reviewSnapshot, setReviewSnapshot] =
    useState<PreviewSendPaymentResult | null>(null)

  const [cchOrder, setCchOrder] = useState<CchOrderView | null>(null)
  const [cchFiberPreview, setCchFiberPreview] =
    useState<PreviewSendPaymentResult | null>(null)
  const [cchQuoteLoading, setCchQuoteLoading] = useState(false)
  const [cchQuoteError, setCchQuoteError] = useState<string | null>(null)

  const invoiceCurrency = invoiceCurrencyLabel(network)
  const relayWarning = available ? relaySendPaymentWarning(relayStatus) : null

  const modeHint =
    sendMode === "invoice"
      ? `Paste a Fiber (${invoiceCurrency}) invoice to pay over the network.`
      : sendMode === "keysend"
        ? "Push an amount to a node pubkey without an invoice."
        : cchConfigured
          ? "Paste a Lightning invoice — paid with cWBTC via your CCH hub."
          : "Lightning payments need a CCH hub URL in Settings."

  const applyInvoiceInput = useCallback((value: string) => {
    if (looksLikeBolt11(value)) {
      setSendMode("lightning")
      setLightningInvoice(value)
      setInvoice("")
      setParsedInvoice(null)
      setParseError(null)
      setRoutePreview(null)
      setPreviewError(null)
      setExistingPayment(null)
      setCchOrder(null)
      setCchQuoteError(null)
      return
    }

    setInvoice(value)
  }, [])

  useEffect(() => {
    if (sendTargets.length === 0) {
      return
    }

    const selectionStillValid = sendTargets.some(
      (target) => target.pubkey === targetPubkey,
    )
    if (targetPubkey && selectionStillValid) {
      return
    }

    const preferred =
      sendTargets.find((target) => target.kind === "channel") ?? sendTargets[0]
    setTargetPubkey(preferred?.pubkey ?? "")
  }, [sendTargets, targetPubkey])

  useEffect(() => {
    if (sendMode !== "invoice") {
      return
    }

    // Keep the review modal stable — do not clear/refetch preview while it is open.
    if (sendDialogOpen) {
      return
    }

    const trimmed = invoice.trim()
    if (!trimmed || !running || !available) {
      setParsedInvoice(null)
      setParseError(null)
      setParseLoading(false)
      setRoutePreview(null)
      setPreviewError(null)
      setPreviewLoading(false)
      setExistingPayment(null)
      return
    }

    let cancelled = false

    const timeout = window.setTimeout(() => {
      void (async () => {
        setParseLoading(true)
        setPreviewLoading(true)
        setParseError(null)
        setPreviewError(null)
        setExistingPayment(null)
        setRoutePreview(null)

        try {
          const preview = await onParseInvoicePreview(trimmed)
          if (cancelled) return
          setParsedInvoice(preview)
          setParseLoading(false)

          try {
            const route = await onPreviewSendPayment({ invoice: trimmed })
            if (cancelled) return
            setRoutePreview(route)
            setPreviewError(null)
            setExistingPayment(null)
          } catch (routeErr) {
            if (cancelled) return
            const message = getErrorMessage(routeErr)
            const existing = parseExistingPaymentSession(message)
            setRoutePreview(null)
            if (existing) {
              setExistingPayment({
                paymentHash: existing.paymentHash,
                status: existing.status,
                message: paymentErrorSummary(message),
              })
              setPreviewError(null)
            } else {
              setExistingPayment(null)
              setPreviewError(paymentErrorSummary(message))
            }
          }
        } catch (parseErr) {
          if (cancelled) return
          const message = getErrorMessage(parseErr)
          setParsedInvoice(null)
          setParseError(paymentErrorSummary(message))
          setRoutePreview(null)
          setPreviewError(null)
          setExistingPayment(null)
        } finally {
          if (cancelled) return
          setParseLoading(false)
          setPreviewLoading(false)
        }
      })()
    }, PREVIEW_DEBOUNCE_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [
    available,
    invoice,
    onParseInvoicePreview,
    onPreviewSendPayment,
    running,
    sendDialogOpen,
    sendMode,
  ])

  useEffect(() => {
    if (sendMode !== "keysend") {
      return
    }

    // Keep the review modal stable — do not clear/refetch preview while it is open.
    if (sendDialogOpen) {
      return
    }

    setExistingPayment(null)

    if (!running || !available) {
      setRoutePreview(null)
      setPreviewError(null)
      setPreviewLoading(false)
      return
    }

    const pubkey = targetPubkey.trim()
    const parsedAmount = Number(keysendAmount.trim())
    if (!pubkey || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setRoutePreview(null)
      setPreviewError(null)
      setPreviewLoading(false)
      return
    }

    let cancelled = false
    setPreviewLoading(true)
    setPreviewError(null)

    const timeout = window.setTimeout(() => {
      void onPreviewKeysendPayment({
        targetPubkey: pubkey,
        amount: parsedAmount,
        udtTypeScript: keysendAsset.udtTypeScript ?? undefined,
      })
        .then((preview) => {
          if (cancelled) return
          setRoutePreview(preview)
          setPreviewError(null)
        })
        .catch((err) => {
          if (cancelled) return
          setRoutePreview(null)
          setPreviewError(paymentErrorSummary(getErrorMessage(err)))
        })
        .finally(() => {
          if (cancelled) return
          setPreviewLoading(false)
        })
    }, PREVIEW_DEBOUNCE_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [
    available,
    keysendAmount,
    keysendAsset.udtTypeScript,
    onPreviewKeysendPayment,
    running,
    sendDialogOpen,
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
    existingPayment === null &&
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

  const canReviewLightning =
    sendMode === "lightning" &&
    cchConfigured &&
    looksLikeBolt11(lightningInvoice) &&
    !cchQuoteLoading &&
    cchOrder !== null &&
    cchQuoteError === null

  const canReviewPayment =
    canReviewInvoice || canReviewKeysend || canReviewLightning

  const handleReviewPayment = useCallback(async () => {
    if (sendMode === "lightning") {
      if (!cchConfigured) {
        setCchQuoteError("Configure a CCH hub RPC URL in Settings first.")
        return
      }
      if (!looksLikeBolt11(lightningInvoice)) {
        setCchQuoteError("Paste a Lightning BOLT11 invoice (lnbc… / lntb…).")
        return
      }

      onClearError()
      setCchQuoteLoading(true)
      setCchQuoteError(null)
      setCchOrder(null)
      setCchFiberPreview(null)

      try {
        const order = await onCchSendBtc(lightningInvoice.trim())
        setCchOrder(order)
        try {
          const preview = await onPreviewSendPayment({
            invoice: order.incomingInvoice,
          })
          setCchFiberPreview(preview)
        } catch (previewErr) {
          // Still allow paying; route preview is best-effort.
          setCchFiberPreview(null)
          setCchQuoteError(
            `Order created, but Fiber route preview failed: ${paymentErrorSummary(getErrorMessage(previewErr))}`,
          )
        }
        setCchDialogOpen(true)
      } catch (error) {
        setCchQuoteError(paymentErrorSummary(getErrorMessage(error)))
      } finally {
        setCchQuoteLoading(false)
      }
      return
    }

    if (!canReviewPayment || !routePreview) return
    onClearError()
    setReviewSnapshot(routePreview)
    setSendDialogOpen(true)
  }, [
    canReviewPayment,
    cchConfigured,
    lightningInvoice,
    onClearError,
    onCchSendBtc,
    onPreviewSendPayment,
    routePreview,
    sendMode,
  ])

  const handleCloseSendDialog = useCallback(() => {
    setSendDialogOpen(false)
    setReviewSnapshot(null)
  }, [])

  const handleCloseCchDialog = useCallback(() => {
    setCchDialogOpen(false)
  }, [])

  return (
    <>
      <div
        id="send-payment-panel"
        className="flex min-w-0 flex-col rounded-lg bg-white shadow-xs ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10"
      >
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <Subheading level={3}>Send</Subheading>
          <Text className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {modeHint}
          </Text>
        </div>

        <div className="flex flex-1 flex-col px-5 py-4">
          {relayWarning ? (
            <Text className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              {relayWarning}
            </Text>
          ) : null}

          <div
            role="tablist"
            aria-label="Send payment mode"
            className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800"
          >
            {(
              [
                ["invoice", "Fiber"],
                ["keysend", "Keysend"],
                ["lightning", "Lightning"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={sendMode === mode}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                  sendMode === mode
                    ? "bg-white text-zinc-950 shadow-xs dark:bg-zinc-900 dark:text-white"
                    : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
                }`}
                onClick={() => setSendMode(mode)}
              >
                {label}
              </button>
            ))}
          </div>

          {sendMode === "invoice" ? (
            <FieldGroup className="mt-4">
              <Field>
                <Label>Fiber invoice</Label>
                <Input
                  type="text"
                  placeholder={`${invoiceCurrency.toLowerCase()}1…`}
                  className="font-mono text-xs"
                  value={invoice}
                  onChange={(event) => applyInvoiceInput(event.target.value)}
                  disabled={!running}
                />
                <Description>
                  {invoiceCurrency} on{" "}
                  {network === "mainnet" ? "mainnet" : "testnet"}. Lightning
                  invoices (ln…) switch to the Lightning tab automatically.
                </Description>
              </Field>
            </FieldGroup>
          ) : sendMode === "lightning" ? (
            <FieldGroup className="mt-4">
              <Field>
                <Label>Lightning invoice</Label>
                <Input
                  type="text"
                  placeholder="lnbc… or lntb…"
                  className="font-mono text-xs"
                  value={lightningInvoice}
                  onChange={(event) => {
                    setLightningInvoice(event.target.value)
                    setCchOrder(null)
                    setCchQuoteError(null)
                  }}
                  disabled={!running}
                />
                <Description>
                  Paid with cWBTC through your configured Cross-Chain Hub.
                </Description>
              </Field>
            </FieldGroup>
          ) : (
            <FieldGroup className="mt-4">
              {sendTargets.length > 0 ? (
                <Field>
                  <Label>Recipient node</Label>
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
                  <Description>
                    Peers with a ready channel you can spend from
                  </Description>
                </Field>
              ) : (
                <Field>
                  <Label>Recipient node</Label>
                  <Input
                    type="text"
                    placeholder="66-character hex pubkey (02 or 03…)"
                    className="font-mono text-xs"
                    value={targetPubkey}
                    onChange={(event) => setTargetPubkey(event.target.value)}
                    disabled={!running}
                  />
                  <Description>Paste the recipient node pubkey</Description>
                </Field>
              )}

              <Field>
                <Label>Asset</Label>
                <Select
                  value={keysendAsset.id}
                  onChange={(event) => setKeysendAssetId(event.target.value)}
                  disabled={!running}
                >
                  {catalog.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.symbol}
                      {asset.name !== asset.symbol ? ` · ${asset.name}` : ""}
                    </option>
                  ))}
                </Select>
                <Description>
                  Whitelisted assets your node can route over Fiber
                </Description>
              </Field>

              <Field>
                <Label>Amount ({keysendAsset.symbol})</Label>
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
                onDismissError={() => setParseError(null)}
              />
            </div>
          ) : null}

          {sendMode === "lightning" && !cchConfigured ? (
            <Text className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              Set a CCH hub RPC URL in{" "}
              <Link
                href="/settings"
                className="font-medium underline underline-offset-2"
              >
                Settings → Cross-chain
              </Link>{" "}
              before paying Lightning invoices.
            </Text>
          ) : null}

          {sendMode === "lightning" && cchQuoteError ? (
            <div className="mt-4">
              <PageErrorBanner
                message={cchQuoteError}
                onDismiss={() => setCchQuoteError(null)}
                className="px-3 py-2.5 text-xs"
              />
            </div>
          ) : null}

          {sendMode === "lightning" && cchOrder && !cchDialogOpen ? (
            <div className="mt-4 rounded-lg bg-zinc-50 px-3 py-2.5 text-xs dark:bg-zinc-800/50">
              <p className="font-medium">
                Hub quote: {cchOrder.amountDisplay} (fee {cchOrder.feeDisplay})
              </p>
              <p className="mt-1 text-zinc-500 dark:text-zinc-400">
                Status {cchOrder.status}
              </p>
            </div>
          ) : null}

          {existingPayment ? (
            <div
              className={`mt-4 rounded-lg px-3 py-2.5 text-xs ${
                existingPayment.status === "Success"
                  ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : existingPayment.status === "Failed"
                    ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
                    : "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
              }`}
            >
              <p className="font-medium">{existingPayment.message}</p>
              <p className="mt-1 font-mono opacity-80">
                {existingPayment.paymentHash.length > 18
                  ? `${existingPayment.paymentHash.slice(0, 14)}…`
                  : existingPayment.paymentHash}
              </p>
            </div>
          ) : sendMode === "invoice" ? (
            <div className="mt-4">
              <PaymentRoutePreview
                preview={routePreview}
                isLoading={previewLoading}
                error={previewError}
                compact
                onDismissError={() => setPreviewError(null)}
                emptyHint="Paste an invoice to preview the route"
              />
            </div>
          ) : sendMode === "keysend" && previewError ? (
            <div className="mt-4">
              <PageErrorBanner
                message={previewError}
                onDismiss={() => setPreviewError(null)}
                className="px-3 py-2.5 text-xs"
              />
            </div>
          ) : null}

          {sendMode === "invoice" &&
          parsedInvoice &&
          !parsedInvoice.networkMatch ? (
            <Text className="mt-3 text-xs text-amber-700 dark:text-amber-300">
              Fix the network mismatch before sending this invoice.
            </Text>
          ) : null}

          {sendMode === "keysend" && sendTargets.length === 0 ? (
            <Text className="mt-3 text-xs text-amber-700 dark:text-amber-300">
              No payable channel peers yet. Open a channel with spendable
              balance, or paste a recipient pubkey if you already have a path.
            </Text>
          ) : null}

          <div className="mt-auto pt-4">
            <Button
              className="w-full"
              onClick={() => void handleReviewPayment()}
              disabled={
                !running ||
                (sendMode === "lightning"
                  ? !cchConfigured ||
                    !looksLikeBolt11(lightningInvoice) ||
                    cchQuoteLoading
                  : !canReviewPayment)
              }
            >
              {sendMode === "lightning"
                ? cchQuoteLoading
                  ? "Creating CCH order…"
                  : "Review Lightning swap"
                : sendMode === "keysend" && previewLoading
                  ? "Finding route…"
                  : "Review payment"}
            </Button>
          </div>
        </div>
      </div>

      {sendMode !== "lightning" ? (
        <SendPaymentDialog
          open={sendDialogOpen}
          onClose={handleCloseSendDialog}
          mode={sendMode === "keysend" ? "keysend" : "invoice"}
          invoice={invoice.trim()}
          targetPubkey={targetPubkey.trim()}
          preview={reviewSnapshot}
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
                  udtTypeScript: keysendAsset.udtTypeScript ?? undefined,
                }
              : undefined
          }
        />
      ) : null}

      <CchSendDialog
        open={cchDialogOpen}
        onClose={handleCloseCchDialog}
        order={cchOrder}
        fiberPreview={cchFiberPreview}
        isActing={isActing}
        actionError={actionError}
        onSendPayment={onSendPayment}
        onGetPayment={onGetPayment}
        onGetCchOrder={onGetCchOrder}
        onPaymentSettled={onPaymentSettled}
        onClearError={onClearError}
      />
    </>
  )
}
