import { useEffect, useRef, useState } from "react"
import { getErrorMessage } from "../../lib/fnn/errors"
import { formatCkb, parseHexU128 } from "../../lib/fnn/ckbAmount"
import {
  parseExistingPaymentSession,
  paymentErrorSuggestsOpenChannels,
  paymentErrorSummary,
  sanitizePaymentError,
} from "../../lib/fnn/format"
import { buildSendOptions } from "../../lib/fnn/maxFee"
import { parseDecimalToRaw } from "../../lib/fnn/preflight"
import type {
  KeysendPaymentPayload,
  PreviewSendPaymentResult,
  SendPaymentPayload,
  SendPaymentResult,
} from "../../lib/fnn/types"
import { truncatePubkey } from "../../lib/public-relays"
import { StatusDot } from "../layout/StatusDot"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
} from "../ui/dialog"
import { Description, Field, FieldGroup, Label } from "../ui/fieldset"
import { Input } from "../ui/input"
import { PageErrorBanner } from "../ui/page-error-banner"
import { Text } from "../ui/text"

type Step = "review" | "inflight" | "success" | "failure"

type SendPaymentDialogProps = {
  open: boolean
  onClose: () => void
  mode: "invoice" | "keysend"
  invoice: string
  targetPubkey: string
  jitLiquidityProvider?: string | null
  jitOpenFeeShannons?: string | null
  jitOpenFeeDisplay?: string | null
  keysendPayload?: KeysendPaymentPayload
  preview: PreviewSendPaymentResult | null
  isActing: boolean
  actionError: string | null
  onSendPayment: (payload: SendPaymentPayload) => Promise<SendPaymentResult>
  onSendKeysendPayment: (
    payload: KeysendPaymentPayload,
  ) => Promise<SendPaymentResult>
  onGetPayment: (paymentHash: string) => Promise<SendPaymentResult>
  onPaymentSettled: () => void
  onClearError: () => void
}

const PAYMENT_POLL_INTERVAL_MS = 2_000
const PAYMENT_POLL_TIMEOUT_MS = 120_000
const DEFAULT_TIMEOUT_SECONDS = 120
const JIT_PAYMENT_TIMEOUT_SECONDS = 20 * 60

function parseDecimalShannons(value: string | null | undefined): bigint {
  if (!value) return 0n
  return BigInt(value)
}

function suggestedMaxFeeCkb(
  preview: PreviewSendPaymentResult | null,
  openFee: bigint,
): string {
  if (preview?.feeShannons) {
    const fee = formatCkb(preview.feeShannons)
    if (fee !== "0") return fee
  }
  if (openFee > 0n) return formatCkb(openFee)
  return ""
}

function truncateInvoice(invoice: string): string {
  if (invoice.length <= 48) return invoice
  return `${invoice.slice(0, 24)}…${invoice.slice(-12)}`
}

function isPendingPaymentStatus(status: string): boolean {
  return status === "Created" || status === "Inflight"
}

export function SendPaymentDialog({
  open,
  onClose,
  mode,
  invoice,
  targetPubkey,
  jitLiquidityProvider = null,
  jitOpenFeeShannons = null,
  jitOpenFeeDisplay = null,
  keysendPayload,
  preview,
  isActing,
  actionError,
  onSendPayment,
  onSendKeysendPayment,
  onGetPayment,
  onPaymentSettled,
  onClearError,
}: SendPaymentDialogProps) {
  const [step, setStep] = useState<Step>("review")
  const [result, setResult] = useState<SendPaymentResult | null>(null)
  const [maxFeeCkb, setMaxFeeCkb] = useState("")
  const [timeoutSeconds, setTimeoutSeconds] = useState(
    String(DEFAULT_TIMEOUT_SECONDS),
  )
  const [localError, setLocalError] = useState<string | null>(null)
  const [frozenPreview, setFrozenPreview] =
    useState<PreviewSendPaymentResult | null>(null)
  const pollStartedAtRef = useRef<number | null>(null)
  const wasOpen = useRef(false)
  const jitPayment = Boolean(jitLiquidityProvider)
  const openFeeRaw = parseDecimalShannons(jitOpenFeeShannons)

  useEffect(() => {
    const justOpened = open && !wasOpen.current
    wasOpen.current = open

    if (justOpened) {
      setStep("review")
      setResult(null)
      setMaxFeeCkb(
        jitLiquidityProvider ? suggestedMaxFeeCkb(preview, openFeeRaw) : "",
      )
      setTimeoutSeconds(
        String(
          jitLiquidityProvider
            ? JIT_PAYMENT_TIMEOUT_SECONDS
            : DEFAULT_TIMEOUT_SECONDS,
        ),
      )
      setLocalError(null)
      pollStartedAtRef.current = null
      setFrozenPreview(preview)
      return
    }

    if (!open) {
      setStep("review")
      setResult(null)
      setMaxFeeCkb("")
      setTimeoutSeconds(String(DEFAULT_TIMEOUT_SECONDS))
      setLocalError(null)
      pollStartedAtRef.current = null
      setFrozenPreview(null)
    }
  }, [jitLiquidityProvider, open, openFeeRaw, preview])

  const activePreview = frozenPreview ?? preview

  useEffect(() => {
    if (step !== "inflight" || !result?.paymentHash) {
      return
    }

    if (pollStartedAtRef.current === null) {
      pollStartedAtRef.current = Date.now()
    }

    const poll = async () => {
      try {
        const updated = await onGetPayment(result.paymentHash)
        setResult(updated)

        if (updated.status === "Success") {
          setStep("success")
          onPaymentSettled()
          return
        }

        if (updated.status === "Failed") {
          setStep("failure")
          onPaymentSettled()
          return
        }

        const requestedTimeoutMs =
          (Number(timeoutSeconds) || DEFAULT_TIMEOUT_SECONDS) * 1000
        if (
          pollStartedAtRef.current !== null &&
          Date.now() - pollStartedAtRef.current >
            Math.max(PAYMENT_POLL_TIMEOUT_MS, requestedTimeoutMs)
        ) {
          setStep("failure")
        }
      } catch {
        // Keep polling — transient RPC errors can occur while inflight.
      }
    }

    void poll()
    const interval = window.setInterval(() => {
      void poll()
    }, PAYMENT_POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(interval)
    }
  }, [onGetPayment, onPaymentSettled, result?.paymentHash, step, timeoutSeconds])

  const handleClose = () => {
    setStep("review")
    setResult(null)
    setLocalError(null)
    pollStartedAtRef.current = null
    onClearError()
    onClose()
  }

  const applyPaymentResult = (paymentResult: SendPaymentResult) => {
    setResult(paymentResult)

    if (paymentResult.status === "Success") {
      setStep("success")
      onPaymentSettled()
      return
    }

    if (paymentResult.status === "Failed") {
      setStep("failure")
      onPaymentSettled()
      return
    }

    if (isPendingPaymentStatus(paymentResult.status)) {
      setStep("inflight")
      return
    }

    setStep("failure")
  }

  const recoverExistingPaymentSession = async (
    error: unknown,
  ): Promise<boolean> => {
    const existing = parseExistingPaymentSession(getErrorMessage(error))
    if (!existing) return false

    try {
      const paymentResult = await onGetPayment(existing.paymentHash)
      onClearError()
      applyPaymentResult(paymentResult)
      return true
    } catch {
      if (
        existing.status === "Success" ||
        isPendingPaymentStatus(existing.status)
      ) {
        onClearError()
        applyPaymentResult({
          paymentHash: existing.paymentHash,
          status: existing.status,
          fee: "0x0",
          failedError: null,
          routeHops: [],
        })
        return true
      }
      return false
    }
  }

  const handleConfirm = async () => {
    setLocalError(null)
    onClearError()
    pollStartedAtRef.current = null
    const openFee = openFeeRaw
    if (openFee > 0n) {
      const cap = parseDecimalToRaw(maxFeeCkb, 8)
      if (cap == null || cap < openFee) {
        setLocalError(
          `Max fee must be at least ${formatCkb(openFee)} CKB to cover the channel open fee.`,
        )
        return
      }
    }
    const sendOptionsResult = buildSendOptions(maxFeeCkb, timeoutSeconds)
    if (!sendOptionsResult.ok) {
      setLocalError(sendOptionsResult.error)
      return
    }
    const sendOptions = sendOptionsResult.options

    try {
      const paymentResult =
        mode === "keysend" && keysendPayload
          ? await onSendKeysendPayment({ ...keysendPayload, ...sendOptions })
          : await onSendPayment({ invoice, ...sendOptions })
      applyPaymentResult(paymentResult)
    } catch (error) {
      const recovered = await recoverExistingPaymentSession(error)
      if (!recovered) {
        setStep("failure")
      }
    }
  }

  const displayAmount = activePreview?.amountDisplay ?? "—"
  const displayFee =
    activePreview?.feeShannons != null
      ? `${formatCkb(activePreview.feeShannons)} CKB`
      : (activePreview?.feeDisplay ?? "—")
  const isKeysend = mode === "keysend"
  const displayError = localError ?? (step === "review" ? actionError : null)

  const rawFailureError = result?.failedError ?? actionError ?? null
  const existingSession = rawFailureError
    ? parseExistingPaymentSession(rawFailureError)
    : null
  const failureSummary =
    rawFailureError ??
    (isPendingPaymentStatus(result?.status ?? "")
      ? "Payment timed out while waiting for confirmation."
      : isKeysend
        ? "Failed to route keysend. Try a saved peer or a direct channel peer."
        : "Failed to send this payment. Add funds if you do not have a channel yet.")
  const failureDetail =
    rawFailureError &&
    !existingSession &&
    paymentErrorSummary(rawFailureError) !== sanitizePaymentError(rawFailureError)
      ? sanitizePaymentError(rawFailureError)
      : null
  const showOpenChannelsCta = paymentErrorSuggestsOpenChannels(rawFailureError)
  const failureBadgeLabel =
    existingSession?.status === "Success"
      ? "Already paid"
      : (result?.status ?? existingSession?.status ?? "Failed")
  const failureBadgeColor =
    existingSession?.status === "Success" ? "green" : "red"
  const failureHeadline =
    existingSession?.status === "Success"
      ? "Payment already completed"
      : "Payment could not be sent"

  const title =
    step === "review"
      ? isKeysend
        ? "Review keysend"
        : "Review payment"
      : step === "inflight"
        ? "Payment in progress"
        : step === "success"
          ? "Payment sent"
          : "Payment failed"

  return (
    <Dialog open={open} onClose={handleClose} size="lg">
      <DialogTitle>{title}</DialogTitle>
      <DialogBody>
        {step === "review" ? (
          <div className="space-y-4">
            <dl className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-sm text-zinc-500 dark:text-zinc-400">Amount</dt>
                <dd className="text-lg font-semibold tabular-nums text-zinc-950 dark:text-white">
                  {displayAmount}
                </dd>
              </div>
              {isKeysend ? (
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-sm text-zinc-500 dark:text-zinc-400">To</dt>
                  <dd className="max-w-[70%] text-right font-mono text-xs text-zinc-700 dark:text-zinc-300">
                    {truncatePubkey(targetPubkey)}
                  </dd>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-sm text-zinc-500 dark:text-zinc-400">Invoice</dt>
                  <dd className="max-w-[70%] text-right font-mono text-xs text-zinc-700 dark:text-zinc-300">
                    {truncateInvoice(invoice)}
                  </dd>
                </div>
              )}
              {jitPayment ? (
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-sm text-zinc-500 dark:text-zinc-400">
                    Channel open
                  </dt>
                  <dd className="max-w-[70%] text-right text-sm text-zinc-700 dark:text-zinc-300">
                    {jitOpenFeeDisplay ?? "Included"}
                    {jitLiquidityProvider
                      ? ` · ${truncatePubkey(jitLiquidityProvider)}`
                      : ""}
                  </dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-4">
                <dt className="text-sm text-zinc-500 dark:text-zinc-400">Fee</dt>
                <dd className="text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
                  {displayFee}
                </dd>
              </div>
            </dl>

            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <Label>Max fee (CKB)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="Node default"
                    value={maxFeeCkb}
                    onChange={(event) => {
                      setMaxFeeCkb(event.target.value)
                      setLocalError(null)
                    }}
                    disabled={isActing}
                  />
                  <Description>
                    {openFeeRaw > 0n
                      ? `Must cover the ${formatCkb(openFeeRaw)} CKB open fee. The rest of the cap pays the route to the liquidity node.`
                      : "Leave empty for the node default fee cap, or enter a positive maximum in CKB"}
                  </Description>
                </Field>
                <Field>
                  <Label>Timeout (seconds)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={timeoutSeconds}
                    onChange={(event) => setTimeoutSeconds(event.target.value)}
                    disabled={isActing}
                  />
                  <Description>
                    {jitPayment
                      ? "Opening the channel waits for funding confirmations. 20 minutes is a starting point."
                      : "Cancel the payment if not completed in time"}
                  </Description>
                </Field>
              </div>
            </FieldGroup>

            {displayError ? (
              <PageErrorBanner
                message={displayError}
                onDismiss={() => {
                  setLocalError(null)
                  onClearError()
                }}
              />
            ) : null}

            <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              Off-chain Fiber payments are irreversible once confirmed.
              {jitPayment
                ? " The liquidity node may open a private channel before the payment finishes."
                : maxFeeCkb.trim() === ""
                  ? " With Max fee empty, FNN applies its own default maximum fee cap (typically around 0.5% of the payment)."
                  : null}
            </div>
          </div>
        ) : step === "inflight" ? (
          <div className="flex flex-col items-center py-4 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/50">
              <StatusDot tone="warning" />
            </div>
            <Text className="text-sm font-medium text-zinc-950 dark:text-white">
              {jitPayment ? "Opening a channel, then routing" : "Payment is being routed"}
            </Text>
            <Text className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {displayAmount} · status {result?.status ?? "Inflight"}
            </Text>
            <Text className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {jitPayment
                ? "The liquidity node is funding a private channel. That can take several minutes while the funding transaction confirms."
                : "Waiting for FNN to confirm the payment…"}
            </Text>
            {result?.paymentHash ? (
              <Text className="mt-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                {result.paymentHash.slice(0, 14)}…
              </Text>
            ) : null}
          </div>
        ) : step === "success" ? (
          <div className="flex flex-col items-center py-4 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50">
              <StatusDot tone="running" />
            </div>
            <Text className="text-sm font-medium text-zinc-950 dark:text-white">
              Payment sent successfully
            </Text>

            <div className="mt-3">
              <Badge color="green">
                <StatusDot tone="running" />
                {result?.status ?? "Success"}
              </Badge>
            </div>
            {result?.fee ? (
              <Text className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Fee {formatCkb(parseHexU128(result.fee))} CKB
              </Text>
            ) : null}
          </div>
        ) : (
          <div className="flex w-full min-w-0 flex-col items-center py-4 text-center">
            <div
              className={`mb-3 flex size-12 items-center justify-center rounded-full ${
                existingSession?.status === "Success"
                  ? "bg-emerald-100 dark:bg-emerald-950/50"
                  : "bg-red-100 dark:bg-red-950/50"
              }`}
            >
              <StatusDot
                tone={
                  existingSession?.status === "Success" ? "running" : "danger"
                }
              />
            </div>
            <Text className="text-sm font-medium text-zinc-950 dark:text-white">
              {failureHeadline}
            </Text>
            <Text className="mt-1 w-full text-pretty text-sm text-zinc-500 dark:text-zinc-400">
              {rawFailureError
                ? paymentErrorSummary(rawFailureError)
                : failureSummary}
            </Text>
            {failureDetail ? (
              <div className="mt-3 w-full max-h-24 overflow-auto rounded-md bg-zinc-100 px-3 py-2 text-left dark:bg-zinc-800/50">
                <p className="font-mono text-xs break-all text-zinc-500 dark:text-zinc-400">
                  {failureDetail}
                </p>
              </div>
            ) : null}
            <div className="mt-3">
              <Badge color={failureBadgeColor}>
                <StatusDot
                  tone={
                    existingSession?.status === "Success" ? "running" : "danger"
                  }
                />
                {failureBadgeLabel}
              </Badge>
            </div>
            {showOpenChannelsCta ? (
              <Button href="/channels?action=open" outline className="mt-4 text-xs">
                Add funds
              </Button>
            ) : null}
          </div>
        )}
      </DialogBody>
      <DialogActions>
        {step === "review" ? (
          <>
            <Button plain onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={() => void handleConfirm()} disabled={isActing}>
              {isActing ? "Sending…" : "Confirm send"}
            </Button>
          </>
        ) : step === "inflight" ? (
          <Button plain onClick={handleClose}>
            Close
          </Button>
        ) : (
          <Button onClick={handleClose}>
            {step === "success" ? "Done" : "Close"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
