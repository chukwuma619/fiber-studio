import { useEffect, useRef, useState } from "react"
import { getErrorMessage } from "../../lib/fnn/errors"
import {
  paymentErrorSuggestsOpenChannels,
  paymentErrorSummary,
  sanitizeRpcError,
} from "../../lib/fnn/format"
import { buildSendOptions, formatEffectiveMaxFeeLabel } from "../../lib/fnn/maxFee"
import type {
  CchOrderView,
  PreviewSendPaymentResult,
  SendPaymentPayload,
  SendPaymentResult,
} from "../../lib/fnn/types"
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

type CchSendDialogProps = {
  open: boolean
  onClose: () => void
  order: CchOrderView | null
  fiberPreview: PreviewSendPaymentResult | null
  isActing: boolean
  actionError: string | null
  onSendPayment: (payload: SendPaymentPayload) => Promise<SendPaymentResult>
  onGetPayment: (paymentHash: string) => Promise<SendPaymentResult>
  onGetCchOrder: (paymentHash: string) => Promise<CchOrderView>
  onPaymentSettled: () => void
  onClearError: () => void
}

const PAYMENT_POLL_INTERVAL_MS = 2_000
const ORDER_POLL_INTERVAL_MS = 5_000
const PAYMENT_POLL_TIMEOUT_MS = 120_000
const DEFAULT_TIMEOUT_SECONDS = 120

function truncateInvoice(invoice: string): string {
  if (invoice.length <= 48) return invoice
  return `${invoice.slice(0, 24)}…${invoice.slice(-12)}`
}

function isPendingPaymentStatus(status: string): boolean {
  return status === "Created" || status === "Inflight"
}

export function CchSendDialog({
  open,
  onClose,
  order,
  fiberPreview,
  isActing,
  actionError,
  onSendPayment,
  onGetPayment,
  onGetCchOrder,
  onPaymentSettled,
  onClearError,
}: CchSendDialogProps) {
  const [step, setStep] = useState<Step>("review")
  const [result, setResult] = useState<SendPaymentResult | null>(null)
  const [liveOrder, setLiveOrder] = useState<CchOrderView | null>(null)
  const [maxFeeCkb, setMaxFeeCkb] = useState("")
  const [timeoutSeconds, setTimeoutSeconds] = useState(
    String(DEFAULT_TIMEOUT_SECONDS),
  )
  const [localError, setLocalError] = useState<string | null>(null)
  const pollStartedAtRef = useRef<number | null>(null)
  const wasOpen = useRef(false)

  useEffect(() => {
    if (open && !wasOpen.current) {
      setStep("review")
      setResult(null)
      setLiveOrder(order)
      setMaxFeeCkb("")
      setTimeoutSeconds(String(DEFAULT_TIMEOUT_SECONDS))
      setLocalError(null)
      pollStartedAtRef.current = null
      onClearError()
    }
    wasOpen.current = open
  }, [onClearError, open, order])

  useEffect(() => {
    if (!open || !liveOrder || liveOrder.isFinal) {
      return
    }

    const interval = window.setInterval(() => {
      void onGetCchOrder(liveOrder.paymentHash)
        .then((next) => {
          setLiveOrder(next)
          if (next.status === "Success") {
            setStep("success")
            onPaymentSettled()
          } else if (next.status === "Failed") {
            setStep("failure")
            setLocalError(next.failureReason ?? "Cross-chain order failed.")
          }
        })
        .catch(() => {
          // Transient hub errors while polling are ignored.
        })
    }, ORDER_POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(interval)
    }
  }, [liveOrder, onGetCchOrder, onPaymentSettled, open])

  useEffect(() => {
    if (!open || step !== "inflight" || !result) {
      return
    }
    if (!isPendingPaymentStatus(result.status)) {
      return
    }

    if (pollStartedAtRef.current === null) {
      pollStartedAtRef.current = Date.now()
    }

    const interval = window.setInterval(() => {
      void (async () => {
        try {
          const next = await onGetPayment(result.paymentHash)
          setResult(next)
          if (next.status === "Failed") {
            setStep("failure")
            setLocalError(
              sanitizeRpcError(next.failedError ?? "Payment failed."),
            )
          } else if (next.status === "Success") {
            // Fiber leg settled; keep polling CCH order for hub Success.
            onPaymentSettled()
          }
        } catch (error) {
          const message = getErrorMessage(error)
          setLocalError(paymentErrorSummary(message))
        }

        if (
          pollStartedAtRef.current !== null &&
          Date.now() - pollStartedAtRef.current > PAYMENT_POLL_TIMEOUT_MS
        ) {
          setStep("failure")
          setLocalError("Timed out waiting for the Fiber payment to settle.")
        }
      })()
    }, PAYMENT_POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(interval)
    }
  }, [onGetPayment, onPaymentSettled, open, result, step])

  const handleConfirm = async () => {
    if (!order) return
    setLocalError(null)
    onClearError()

    const sendOptionsResult = buildSendOptions(maxFeeCkb, timeoutSeconds)
    if (!sendOptionsResult.ok) {
      setLocalError(sendOptionsResult.error)
      return
    }

    try {
      setStep("inflight")
      pollStartedAtRef.current = Date.now()
      const sent = await onSendPayment({
        invoice: order.incomingInvoice,
        ...sendOptionsResult.options,
      })
      setResult(sent)
      if (sent.status === "Failed") {
        setStep("failure")
        setLocalError(sanitizeRpcError(sent.failedError ?? "Payment failed."))
      }
    } catch (error) {
      setStep("failure")
      const message = getErrorMessage(error)
      setLocalError(paymentErrorSummary(message))
    }
  }

  const displayError = localError ?? actionError
  const activeOrder = liveOrder ?? order

  return (
    <Dialog open={open} onClose={onClose} size="lg">
      <DialogTitle>
        {step === "review"
          ? "Review Lightning swap"
          : step === "inflight"
            ? "Paying via CCH…"
            : step === "success"
              ? "Swap complete"
              : "Swap failed"}
      </DialogTitle>
      <DialogBody>
        {displayError ? (
          <PageErrorBanner
            message={displayError}
            className="mb-4"
          />
        ) : null}

        {activeOrder ? (
          <div className="space-y-3 rounded-lg bg-zinc-50 px-4 py-3 text-sm dark:bg-zinc-800/50">
            <div className="flex items-center justify-between gap-3">
              <Text>CCH status</Text>
              <Badge>{activeOrder.status}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Text>You pay</Text>
              <Text className="font-medium">{activeOrder.amountDisplay}</Text>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Text>Hub fee</Text>
              <Text className="font-medium">{activeOrder.feeDisplay}</Text>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Text>Fiber invoice</Text>
              <Text className="max-w-[60%] break-all text-right font-mono text-xs">
                {truncateInvoice(activeOrder.incomingInvoice)}
              </Text>
            </div>
          </div>
        ) : null}

        {fiberPreview && step === "review" ? (
          <div className="mt-4 space-y-2 text-sm">
            <Text>
              Estimated Fiber fee:{" "}
              <span className="font-medium">{fiberPreview.feeDisplay}</span>
            </Text>
            {fiberPreview.routeHops.length > 0 ? (
              <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                Route hops: {fiberPreview.routeHops.length}
              </Text>
            ) : null}
          </div>
        ) : null}

        {step === "review" ? (
          <FieldGroup className="mt-4">
            <Field>
              <Label>Max Fiber fee (CKB, optional)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={maxFeeCkb}
                onChange={(event) => setMaxFeeCkb(event.target.value)}
              />
              <Description>
                {formatEffectiveMaxFeeLabel(maxFeeCkb)} Leaves room for routing
                fees on the Fiber leg.
              </Description>
            </Field>
            <Field>
              <Label>Timeout (seconds)</Label>
              <Input
                type="number"
                min={30}
                value={timeoutSeconds}
                onChange={(event) => setTimeoutSeconds(event.target.value)}
              />
            </Field>
          </FieldGroup>
        ) : null}

        {step === "inflight" && result ? (
          <div className="mt-4 flex items-center gap-2 text-sm">
            <StatusDot tone="warning" />
            <Text>
              Fiber payment {result.status}
              {paymentErrorSuggestsOpenChannels(displayError ?? "")
                ? " — you may need a cWBTC channel toward the hub."
                : ""}
            </Text>
          </div>
        ) : null}
      </DialogBody>
      <DialogActions>
        <Button plain onClick={onClose}>
          {step === "review" ? "Cancel" : "Close"}
        </Button>
        {step === "review" ? (
          <Button onClick={() => void handleConfirm()} disabled={isActing || !order}>
            {isActing ? "Sending…" : "Pay Fiber invoice"}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  )
}
