import { useEffect, useMemo, useRef, useState } from "react"
import { getErrorMessage } from "../../lib/fnn/errors"
import {
  defaultAsset,
  findAssetForScript,
} from "../../lib/fnn/assets"
import {
  formatRouteHopsShort,
  paymentErrorSummary,
  validateHumanAmount,
} from "../../lib/fnn/format"
import { formatEffectiveMaxFeeLabel, parseMaxFeeCkbInput } from "../../lib/fnn/maxFee"
import {
  channelLiquidityHealth,
  formatAssetAmount,
  maxRebalanceAmountRaw,
  readySameAssetChannels,
  rebalanceRolesForFocus,
  suggestedRebalanceAmount,
  suggestRebalanceCounterpart,
} from "../../lib/fnn/liquidityHealth"
import type {
  AssetView,
  HomeChannel,
  RebalanceChannelPayload,
  RebalanceChannelResult,
  SendPaymentResult,
} from "../../lib/fnn/types"
import { truncatePubkey } from "../../lib/public-relays"
import { PaymentRoutePreview } from "../payments/PaymentRoutePreview"
import { Badge } from "../ui/badge"
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
import { Select } from "../ui/select"
import { Text } from "../ui/text"
import { LiquidityHealthIndicator } from "./LiquidityHealthIndicator"

type Step = "form" | "inflight" | "success" | "failure"

type RebalanceChannelDialogProps = {
  open: boolean
  focusChannel: HomeChannel | null
  channels: HomeChannel[]
  assets: AssetView[]
  isActing: boolean
  actionError: string | null
  onPreview: (payload: RebalanceChannelPayload) => Promise<RebalanceChannelResult>
  onRebalance: (payload: RebalanceChannelPayload) => Promise<RebalanceChannelResult>
  onGetPayment: (paymentHash: string) => Promise<SendPaymentResult>
  onSettled: () => void
  onClearError: () => void
  onClose: () => void
}

const PAYMENT_POLL_INTERVAL_MS = 2_000
const PAYMENT_POLL_TIMEOUT_MS = 120_000

function channelAsset(channel: HomeChannel, assets: AssetView[]): AssetView {
  if (channel.fundingUdtTypeScript) {
    return (
      findAssetForScript(assets, channel.fundingUdtTypeScript) ?? {
        id: channel.assetSymbol.toLowerCase(),
        name: channel.assetSymbol,
        symbol: channel.assetSymbol,
        decimals: 8,
        udtTypeScript: channel.fundingUdtTypeScript,
      }
    )
  }
  return defaultAsset(assets)
}

function channelOptionLabel(channel: HomeChannel): string {
  const health = channelLiquidityHealth(channel)
  return `${truncatePubkey(channel.pubkey)} · ${channel.localPercent}% outbound · ${health.label}`
}

function strategyDescription(strategy: string): string {
  switch (strategy) {
    case "explicit_route":
      return "Fiber will send a circular payment that leaves through the source channel and returns through the target channel."
    case "circular_self_payment":
      return "This preview used an unpinned circular path, which can move the wrong channels. Preview again to require an explicit source→target route."
    default:
      return "This is a circular self-payment pinned to the source and target channels. Your total balance stays the same except for routing fees."
  }
}

function defaultMaxFee(asset: AssetView): string {
  return asset.symbol.toUpperCase() === "CKB" ? "1" : ""
}

function isFailedPayment(result: RebalanceChannelResult): boolean {
  return (
    result.status.toLowerCase() === "failed" ||
    Boolean(result.failedError?.trim())
  )
}

export function RebalanceChannelDialog({
  open,
  focusChannel,
  channels,
  assets,
  isActing,
  actionError,
  onPreview,
  onRebalance,
  onGetPayment,
  onSettled,
  onClearError,
  onClose,
}: RebalanceChannelDialogProps) {
  const [step, setStep] = useState<Step>("form")
  const [sourceId, setSourceId] = useState("")
  const [targetId, setTargetId] = useState("")
  const [amount, setAmount] = useState("")
  const [maxFee, setMaxFee] = useState("")
  const [validationError, setValidationError] = useState<string | null>(null)
  const [preview, setPreview] = useState<RebalanceChannelResult | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [result, setResult] = useState<RebalanceChannelResult | SendPaymentResult | null>(null)
  const pollStartedAtRef = useRef<number | null>(null)
  const wasOpen = useRef(false)

  const source = useMemo(
    () => channels.find((channel) => channel.channelId === sourceId) ?? null,
    [channels, sourceId],
  )
  const target = useMemo(
    () => channels.find((channel) => channel.channelId === targetId) ?? null,
    [channels, targetId],
  )
  const selectedAsset = source ? channelAsset(source, assets) : defaultAsset(assets)
  const candidates = source
    ? readySameAssetChannels(channels, source)
    : channels.filter((channel) => channel.state === "ChannelReady")
  const sourceOptions = candidates
  const targetOptions = candidates.filter((channel) => channel.channelId !== sourceId)

  const maxAmountDisplay = useMemo(() => {
    if (!source || !target) return null
    const maxRaw = maxRebalanceAmountRaw(source, target)
    if (maxRaw === 0n) return null
    return `${formatAssetAmount(maxRaw, selectedAsset)} ${selectedAsset.symbol}`
  }, [selectedAsset, source, target])

  function applySuggestedAmount(
    nextSource: HomeChannel | null,
    nextTarget: HomeChannel | null,
  ) {
    if (nextSource && nextTarget && nextSource.channelId !== nextTarget.channelId) {
      setAmount(
        suggestedRebalanceAmount(
          nextSource,
          nextTarget,
          channelAsset(nextSource, assets),
        ),
      )
      return
    }
    setAmount("")
  }

  useEffect(() => {
    const justOpened = open && !wasOpen.current
    wasOpen.current = open
    if (!justOpened) {
      if (!open) {
        setStep("form")
        setResult(null)
        setPreview(null)
        setPreviewError(null)
        setValidationError(null)
        pollStartedAtRef.current = null
      }
      return
    }

    onClearError()
    setStep("form")
    setResult(null)
    setPreview(null)
    setPreviewError(null)
    setValidationError(null)
    setPreviewLoading(false)
    pollStartedAtRef.current = null

    if (!focusChannel) {
      setSourceId("")
      setTargetId("")
      setAmount("")
      setMaxFee("")
      return
    }

    const roles = rebalanceRolesForFocus(focusChannel)
    const counterpart = suggestRebalanceCounterpart(focusChannel, channels)
    const nextSourceId = roles.sourceId || counterpart?.channelId || ""
    const nextTargetId = roles.targetId || counterpart?.channelId || ""
    setSourceId(nextSourceId)
    setTargetId(nextTargetId === nextSourceId ? "" : nextTargetId)

    const nextSource =
      channels.find((channel) => channel.channelId === nextSourceId) ?? null
    const nextTarget =
      channels.find((channel) => channel.channelId === nextTargetId) ?? null
    applySuggestedAmount(
      nextSource,
      nextTarget && nextTarget.channelId !== nextSourceId ? nextTarget : null,
    )
    setMaxFee(defaultMaxFee(channelAsset(focusChannel, assets)))
  }, [assets, channels, focusChannel, onClearError, open])

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
          onSettled()
          return
        }
        if (updated.status === "Failed") {
          setStep("failure")
          return
        }
        if (
          pollStartedAtRef.current !== null &&
          Date.now() - pollStartedAtRef.current > PAYMENT_POLL_TIMEOUT_MS
        ) {
          setStep("failure")
        }
      } catch {
        if (
          pollStartedAtRef.current !== null &&
          Date.now() - pollStartedAtRef.current > PAYMENT_POLL_TIMEOUT_MS
        ) {
          setStep("failure")
        }
      }
    }

    const interval = window.setInterval(() => {
      void poll()
    }, PAYMENT_POLL_INTERVAL_MS)
    void poll()

    return () => {
      window.clearInterval(interval)
    }
  }, [onGetPayment, onSettled, result?.paymentHash, step])

  function resetPreview() {
    setPreview(null)
    setPreviewError(null)
  }

  async function handlePreview() {
    if (!source || !target) {
      setValidationError("Select a source channel and a different target channel.")
      return
    }

    const amountError = validateHumanAmount(amount, selectedAsset.decimals)
    if (amountError) {
      setValidationError(amountError)
      return
    }

    if (selectedAsset.symbol.toUpperCase() === "CKB") {
      const maxFeeParsed = parseMaxFeeCkbInput(maxFee)
      if (maxFeeParsed.status === "error") {
        setValidationError(maxFeeParsed.message)
        return
      }
    } else if (maxFee.trim()) {
      const maxFeeError = validateHumanAmount(maxFee, selectedAsset.decimals)
      if (maxFeeError) {
        setValidationError(`Max fee: ${maxFeeError}`)
        return
      }
    }

    setValidationError(null)
    onClearError()
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      const nextPreview = await onPreview({
        sourceChannelId: source.channelId,
        targetChannelId: target.channelId,
        amount: amount.trim(),
        dryRun: true,
        maxFee: maxFee.trim() || undefined,
        strategy: "explicit_route",
      })
      if (isFailedPayment(nextPreview) || nextPreview.strategy === "circular_self_payment") {
        setPreview(null)
        setPreviewError(
          nextPreview.failedError?.trim() ||
            (nextPreview.strategy === "circular_self_payment"
              ? "Fiber could not pin this rebalance to the selected channels."
              : "Fiber could not build a circular route between these channels."),
        )
        return
      }
      setPreview(nextPreview)
    } catch (error) {
      setPreview(null)
      setPreviewError(getErrorMessage(error))
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleConfirm() {
    if (!source || !target || !preview) return

    setValidationError(null)
    onClearError()
    pollStartedAtRef.current = null
    try {
      const paymentResult = await onRebalance({
        sourceChannelId: source.channelId,
        targetChannelId: target.channelId,
        amount: amount.trim(),
        dryRun: false,
        maxFee: maxFee.trim() || undefined,
        strategy: "explicit_route",
      })
      setResult(paymentResult)
      if (isFailedPayment(paymentResult)) {
        setStep("failure")
        return
      }
      if (paymentResult.status === "Success") {
        setStep("success")
        onSettled()
        return
      }
      setStep("inflight")
    } catch {
      setStep("failure")
    }
  }

  function handleDismiss() {
    if (isActing) return
    onClearError()
    onClose()
  }

  const dialogTitle = (() => {
    switch (step) {
      case "form":
        return "Rebalance channel"
      case "inflight":
        return "Rebalance in progress"
      case "success":
        return "Rebalance complete"
      case "failure":
        return "Rebalance failed"
      default: {
        const unreachable: never = step
        return unreachable
      }
    }
  })()

  const failureMessage =
    result && "failedError" in result && result.failedError
      ? paymentErrorSummary(result.failedError)
      : actionError
        ? paymentErrorSummary(actionError)
        : previewError
          ? paymentErrorSummary(previewError)
          : step === "failure"
            ? "The circular payment timed out or could not be completed."
            : "The circular payment could not be completed."

  return (
    <Dialog open={open} onClose={isActing ? () => {} : handleDismiss} size="lg">
      <DialogTitle>{dialogTitle}</DialogTitle>
      {step === "form" ? (
        <DialogDescription>
          Move liquidity with a circular self-payment. Funds leave the
          outbound-heavy source channel and return through the inbound-heavy
          target channel. Only routing fees leave your node.
        </DialogDescription>
      ) : null}

      <DialogBody>
        {step === "form" ? (
          <div className="space-y-6">
            <FieldGroup>
              <Field>
                <Label>Source channel (send from)</Label>
                <Select
                  value={sourceId}
                  onChange={(event) => {
                    const nextSourceId = event.target.value
                    const nextTargetId =
                      nextSourceId === targetId ? "" : targetId
                    setSourceId(nextSourceId)
                    if (nextSourceId === targetId) {
                      setTargetId("")
                    }
                    applySuggestedAmount(
                      channels.find((channel) => channel.channelId === nextSourceId) ??
                        null,
                      nextTargetId
                        ? channels.find((channel) => channel.channelId === nextTargetId) ??
                          null
                        : null,
                    )
                    resetPreview()
                  }}
                  disabled={isActing}
                >
                  <option value="">Select a channel with outbound capacity</option>
                  {sourceOptions.map((channel) => (
                    <option key={channel.channelId} value={channel.channelId}>
                      {channelOptionLabel(channel)}
                    </option>
                  ))}
                </Select>
                <Description>
                  Outbound-heavy channels have most funds on your side and can
                  send but not receive much.
                </Description>
              </Field>

              {source ? <LiquidityHealthIndicator channel={source} /> : null}

              <Field>
                <Label>Target channel (receive into)</Label>
                <Select
                  value={targetId}
                  onChange={(event) => {
                    const nextTargetId = event.target.value
                    setTargetId(nextTargetId)
                    applySuggestedAmount(
                      source,
                      channels.find((channel) => channel.channelId === nextTargetId) ??
                        null,
                    )
                    resetPreview()
                  }}
                  disabled={isActing || !sourceId}
                >
                  <option value="">Select a channel with inbound capacity</option>
                  {targetOptions.map((channel) => (
                    <option key={channel.channelId} value={channel.channelId}>
                      {channelOptionLabel(channel)}
                    </option>
                  ))}
                </Select>
                <Description>
                  Inbound-heavy channels have most funds on the peer side and
                  can receive but not send much.
                </Description>
              </Field>

              {target ? <LiquidityHealthIndicator channel={target} /> : null}

              <Field>
                <Label>Asset</Label>
                <div className="flex items-center gap-2">
                  <Badge color="zinc">{selectedAsset.symbol}</Badge>
                  <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                    Both channels must use this asset.
                  </Text>
                </div>
              </Field>

              <Field>
                <Label>Amount to move ({selectedAsset.symbol})</Label>
                <Input
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value)
                    resetPreview()
                  }}
                  inputMode={selectedAsset.decimals === 0 ? "numeric" : "decimal"}
                  placeholder={maxAmountDisplay ?? "0"}
                  disabled={isActing || !source || !target}
                />
                <Description>
                  {maxAmountDisplay
                    ? `Up to ${maxAmountDisplay} after leaving a reserve on both channels.`
                    : "Pick two ready same-asset channels to see the maximum."}
                </Description>
              </Field>

              <Field>
                <Label>Max routing fee ({selectedAsset.symbol})</Label>
                <Input
                  value={maxFee}
                  onChange={(event) => {
                    setMaxFee(event.target.value)
                    resetPreview()
                  }}
                  inputMode={selectedAsset.decimals === 0 ? "numeric" : "decimal"}
                  placeholder={selectedAsset.symbol.toUpperCase() === "CKB" ? "1" : "optional"}
                  disabled={isActing || !source || !target}
                />
                <Description>
                  {selectedAsset.symbol.toUpperCase() === "CKB"
                    ? `${formatEffectiveMaxFeeLabel(maxFee)}. Defaults to 1 CKB if you leave the backend default.`
                    : "Defaults to 1% of the amount if left empty. Preview is rejected when the fee is higher."}
                </Description>
              </Field>
            </FieldGroup>

            <PaymentRoutePreview
              preview={
                preview
                  ? {
                      feeShannons: preview.fee,
                      feeDisplay: preview.feeDisplay,
                      amountDisplay: preview.amountDisplay,
                      assetSymbol: preview.assetSymbol,
                      routeHops: preview.routeHops,
                    }
                  : null
              }
              isLoading={previewLoading}
              error={previewError}
              emptyHint="Preview the circular route before moving funds."
              allowEmptyHops
              onDismissError={() => setPreviewError(null)}
            />

            {preview ? (
              <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                {strategyDescription(preview.strategy)}
              </Text>
            ) : null}

            {validationError ? (
              <Text className="text-sm text-red-600 dark:text-red-400">
                {validationError}
              </Text>
            ) : null}
            {actionError && step === "form" ? (
              <PageErrorBanner
                message={actionError}
                onDismiss={onClearError}
              />
            ) : null}
          </div>
        ) : step === "inflight" ? (
          <Text className="text-sm text-zinc-600 dark:text-zinc-400">
            Sending a circular payment
            {preview?.routeHops.length
              ? ` via ${formatRouteHopsShort(preview.routeHops)}`
              : ""}
            . This can take a minute.
          </Text>
        ) : step === "success" ? (
          <div className="space-y-3">
            <Text className="text-sm text-zinc-600 dark:text-zinc-400">
              Liquidity moved
              {preview?.amountDisplay ? ` (${preview.amountDisplay})` : ""}.
              {preview?.feeDisplay ? ` Routing fee ${preview.feeDisplay}.` : ""}{" "}
              Refresh Channels to see the new inbound/outbound split.
            </Text>
          </div>
        ) : (
          <PageErrorBanner message={failureMessage} />
        )}
      </DialogBody>

      <DialogActions>
        {step === "form" ? (
          <>
            <Button plain onClick={handleDismiss} disabled={isActing}>
              Cancel
            </Button>
            {preview ? (
              <Button onClick={() => void handleConfirm()} disabled={isActing}>
                {isActing ? "Rebalancing…" : "Confirm rebalance"}
              </Button>
            ) : (
              <Button
                onClick={() => void handlePreview()}
                disabled={isActing || previewLoading || !sourceId || !targetId || !amount.trim()}
              >
                {previewLoading ? "Finding route…" : "Preview route"}
              </Button>
            )}
          </>
        ) : step === "inflight" ? (
          <Button plain disabled>
            Waiting for Fiber…
          </Button>
        ) : (
          <Button onClick={handleDismiss}>Done</Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
