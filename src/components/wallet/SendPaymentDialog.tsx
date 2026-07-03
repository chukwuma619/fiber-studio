import { useEffect, useRef, useState } from "react"
import { formatCkb, parseHexU128, paymentErrorSummary, paymentRouteBadgeLabel, sanitizePaymentError } from "../../lib/fnn/format"
import type {
  KeysendPaymentPayload,
  PreviewSendPaymentResult,
  SendPaymentMode,
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
import { Text } from "../ui/text"

type Step = "review" | "inflight" | "success" | "failure"

type SendPaymentDialogProps = {
  open: boolean
  onClose: () => void
  mode: SendPaymentMode
  invoice: string
  targetPubkey: string
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

function truncateInvoice(invoice: string): string {
  if (invoice.length <= 48) return invoice
  return `${invoice.slice(0, 24)}…${invoice.slice(-12)}`
}

function formatRouteHops(hops: string[]): string {
  return hops.map((pubkey) => truncatePubkey(pubkey)).join(" → ")
}

function isPendingPaymentStatus(status: string): boolean {
  return status === "Created" || status === "Inflight"
}

function buildSendOptions(maxFeeCkb: string, timeoutSeconds: string) {
  const parsedMaxFee = Number(maxFeeCkb.trim())
  const parsedTimeout = Number(timeoutSeconds.trim())

  return {
    maxFeeCkb:
      maxFeeCkb.trim() && Number.isFinite(parsedMaxFee) && parsedMaxFee > 0
        ? parsedMaxFee
        : undefined,
    timeoutSeconds:
      timeoutSeconds.trim() &&
      Number.isInteger(parsedTimeout) &&
      parsedTimeout > 0
        ? parsedTimeout
        : undefined,
  }
}

export function SendPaymentDialog({
  open,
  onClose,
  mode,
  invoice,
  targetPubkey,
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
  const pollStartedAtRef = useRef<number | null>(null)

  useEffect(() => {
    if (!open) {
      setStep("review")
      setResult(null)
      setMaxFeeCkb("")
      setTimeoutSeconds(String(DEFAULT_TIMEOUT_SECONDS))
      pollStartedAtRef.current = null
    }
  }, [open])

  useEffect(() => {
    if (!open || step !== "review" || !preview?.feeCkb || maxFeeCkb) {
      return
    }

    const suggested = preview.feeCkb.replace(/\s*CKB$/i, "").trim()
    if (suggested) {
      setMaxFeeCkb(suggested)
    }
  }, [maxFeeCkb, open, preview?.feeCkb, step])

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

        if (
          pollStartedAtRef.current !== null &&
          Date.now() - pollStartedAtRef.current > PAYMENT_POLL_TIMEOUT_MS
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
  }, [onGetPayment, onPaymentSettled, result?.paymentHash, step])

  const handleClose = () => {
    setStep("review")
    setResult(null)
    pollStartedAtRef.current = null
    onClearError()
    onClose()
  }

  const handleConfirm = async () => {
    onClearError()
    pollStartedAtRef.current = null
    const sendOptions = buildSendOptions(maxFeeCkb, timeoutSeconds)

    try {
      const paymentResult =
        mode === "keysend" && keysendPayload
          ? await onSendKeysendPayment({ ...keysendPayload, ...sendOptions })
          : await onSendPayment({ invoice, ...sendOptions })
      setResult(paymentResult)

      if (paymentResult.status === "Success") {
        setStep("success")
        onPaymentSettled()
      } else if (paymentResult.status === "Failed") {
        setStep("failure")
        onPaymentSettled()
      } else if (isPendingPaymentStatus(paymentResult.status)) {
        setStep("inflight")
      } else {
        setStep("failure")
      }
    } catch {
      setStep("failure")
    }
  }

  const displayAmount = preview?.amountDisplay ?? "—"
  const displayFee = preview?.feeCkb ?? "—"
  const hopCount = preview?.routeHops.length ?? result?.routeHops.length ?? 0
  const routeBadge = paymentRouteBadgeLabel(hopCount)
  const displayRoute = hopCount > 0
    ? formatRouteHops(preview?.routeHops ?? result?.routeHops ?? [])
    : "—"
  const isKeysend = mode === "keysend"

  const rawFailureError = result?.failedError ?? actionError ?? null
  const failureSummary =
    rawFailureError ??
    (isPendingPaymentStatus(result?.status ?? "")
      ? "Payment timed out while waiting for confirmation."
      : isKeysend
        ? "Failed to route keysend. Try a saved peer or a direct channel peer."
        : "Failed to build route. Open a channel, ensure your peer is connected, and wait for the network graph to sync.")
  const failureDetail =
    rawFailureError && paymentErrorSummary(rawFailureError) !== sanitizePaymentError(rawFailureError)
      ? sanitizePaymentError(rawFailureError)
      : null

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
            <div className="flex items-center gap-2">
              <Badge color="sky">{routeBadge}</Badge>
              <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                {isKeysend ? "Keysend via Fiber" : "Off-chain via Fiber"}
              </Text>
            </div>

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
              <div className="flex items-center justify-between gap-4">
                <dt className="text-sm text-zinc-500 dark:text-zinc-400">
                  Est. route fee
                </dt>
                <dd className="text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
                  {displayFee}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-sm text-zinc-500 dark:text-zinc-400">Route</dt>
                <dd className="max-w-[70%] text-right font-mono text-xs text-zinc-600 dark:text-zinc-400">
                  {displayRoute}
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
                    placeholder="0.00"
                    value={maxFeeCkb}
                    onChange={(event) => setMaxFeeCkb(event.target.value)}
                    disabled={isActing}
                  />
                  <Description>
                    Maximum routing fee you are willing to pay
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
                    Cancel the payment if not completed in time
                  </Description>
                </Field>
              </div>
            </FieldGroup>

            <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              Off-chain Fiber payments are irreversible once confirmed.
            </div>
          </div>
        ) : step === "inflight" ? (
          <div className="flex flex-col items-center py-4 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/50">
              <StatusDot tone="warning" />
            </div>
            <Text className="text-sm font-medium text-zinc-950 dark:text-white">
              Payment is being routed
            </Text>
            <Text className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {displayAmount} · status {result?.status ?? "Inflight"}
            </Text>
            <Text className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Waiting for FNN to confirm the payment…
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
            <Text className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {displayAmount} sent off-chain via Fiber
            </Text>
            {result?.routeHops.length ? (
              <Text className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                {formatRouteHops(result.routeHops)}
              </Text>
            ) : null}
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
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/50">
              <StatusDot tone="danger" />
            </div>
            <Text className="text-sm font-medium text-zinc-950 dark:text-white">
              Payment could not be sent
            </Text>
            <Text className="mt-1 w-full text-pretty text-sm text-zinc-500 dark:text-zinc-400">
              {rawFailureError ? paymentErrorSummary(rawFailureError) : failureSummary}
            </Text>
            {failureDetail ? (
              <div className="mt-3 w-full max-h-24 overflow-auto rounded-md bg-zinc-100 px-3 py-2 text-left dark:bg-zinc-800/50">
                <p className="font-mono text-xs break-all text-zinc-500 dark:text-zinc-400">
                  {failureDetail}
                </p>
              </div>
            ) : null}
            <div className="mt-3">
              <Badge color="red">
                <StatusDot tone="danger" />
                {result?.status ?? "Failed"}
              </Badge>
            </div>
            <Button href="/channels" outline className="mt-4 text-xs">
              Open channels
            </Button>
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
