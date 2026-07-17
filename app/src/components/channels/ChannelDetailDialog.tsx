import { useEffect, useState } from "react"
import {
  canAbandonChannel,
  canCloseChannel,
  channelStateBadgeColor,
  channelStateDisplayLabel,
  formatCkb,
  fundingTxHashFromOutpoint,
  parseHexU128,
} from "../../lib/fnn/format"
import type {
  AbandonChannelPayload,
  HomeChannel,
  ShutdownChannelPayload,
} from "../../lib/fnn/types"
import { truncatePubkey } from "../../lib/public-relays"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { CopyButton } from "../ui/copy-button"
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
} from "../ui/description-list"
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
} from "../ui/dialog"
import { HelpTooltip } from "../ui/help-tooltip"
import { PageErrorBanner } from "../ui/page-error-banner"
import { Text } from "../ui/text"

type Step = "detail" | "confirm-close" | "confirm-abandon"

type ChannelDetailDialogProps = {
  open: boolean
  channel: HomeChannel | null
  onClose: () => void
  isActing: boolean
  actionError: string | null
  onShutdownChannel: (payload: ShutdownChannelPayload) => Promise<void>
  onAbandonChannel: (payload: AbandonChannelPayload) => Promise<void>
  onClearError: () => void
}

function closeDisabledReason(state: string): string | null {
  if (state === "ShuttingDown") {
    return "This channel is already closing."
  }
  if (!canCloseChannel(state)) {
    return "Only active channels can be closed cooperatively."
  }
  return null
}

function abandonDisabledReason(state: string): string | null {
  if (canAbandonChannel(state)) {
    return null
  }
  if (state === "ChannelReady") {
    return "Use close channel for active channels."
  }
  if (state === "ShuttingDown") {
    return "This channel is already closing."
  }
  return "This channel cannot be abandoned."
}

export function ChannelDetailDialog({
  open,
  channel,
  onClose,
  isActing,
  actionError,
  onShutdownChannel,
  onAbandonChannel,
  onClearError,
}: ChannelDetailDialogProps) {
  const [step, setStep] = useState<Step>("detail")

  useEffect(() => {
    if (open) {
      setStep("detail")
    }
  }, [open, channel?.channelId])

  if (!channel) {
    return null
  }

  const localBalance = formatCkb(parseHexU128(channel.localBalance))
  const remoteBalance = formatCkb(parseHexU128(channel.remoteBalance))
  const capacity = formatCkb(
    parseHexU128(channel.localBalance) + parseHexU128(channel.remoteBalance),
  )
  const fundingTxHash = fundingTxHashFromOutpoint(channel.channelOutpoint)
  const stateLabel = channelStateDisplayLabel(channel.state)
  const badgeColor = channelStateBadgeColor(
    channel.state,
    channel.localPercent,
  )
  const closeReason = closeDisabledReason(channel.state)
  const abandonReason = abandonDisabledReason(channel.state)
  const isReady = channel.state === "ChannelReady"
  const showAbandon = canAbandonChannel(channel.state)
  const channelId = channel.channelId

  function handleDismiss() {
    setStep("detail")
    onClearError()
    onClose()
  }

  async function handleConfirmClose() {
    try {
      await onShutdownChannel({ channelId })
      handleDismiss()
    } catch {
      // actionError is set by the hook
    }
  }

  async function handleConfirmAbandon() {
    try {
      await onAbandonChannel({ channelId })
      handleDismiss()
    } catch {
      // actionError is set by the hook
    }
  }

  const dialogTitle = (() => {
    switch (step) {
      case "detail":
        return "Channel details"
      case "confirm-close":
        return "Close channel"
      case "confirm-abandon":
        return "Abandon channel"
      default: {
        const unreachable: never = step
        return unreachable
      }
    }
  })()

  return (
    <Dialog
      open={open}
      onClose={isActing ? () => {} : handleDismiss}
      size="lg"
    >
      <DialogTitle>{dialogTitle}</DialogTitle>

      <DialogBody>
        {step === "detail" ? (
          <div className="space-y-6">
            <DescriptionList>
              <DescriptionTerm>Peer pubkey</DescriptionTerm>
              <DescriptionDetails>
                <div className="flex items-start gap-2">
                  <span className="min-w-0 flex-1 font-mono text-xs break-all text-zinc-600 dark:text-zinc-300">
                    {channel.pubkey}
                  </span>
                  <CopyButton value={channel.pubkey} label="Copy peer pubkey" />
                </div>
              </DescriptionDetails>

              <DescriptionTerm>Channel ID</DescriptionTerm>
              <DescriptionDetails>
                <div className="flex items-start gap-2">
                  <span className="min-w-0 flex-1 font-mono text-xs break-all text-zinc-600 dark:text-zinc-300">
                    {channel.channelId}
                  </span>
                  <CopyButton value={channel.channelId} label="Copy channel ID" />
                </div>
              </DescriptionDetails>

              {fundingTxHash ? (
                <>
                  <DescriptionTerm>Funding Tx</DescriptionTerm>
                  <DescriptionDetails>
                    <div className="flex flex-wrap items-start gap-2">
                      <span className="min-w-0 flex-1 font-mono text-xs break-all text-zinc-600 dark:text-zinc-300">
                        {fundingTxHash}
                      </span>
                      <CopyButton
                        value={fundingTxHash}
                        label="Copy funding transaction hash"
                      />
                    </div>
                  </DescriptionDetails>
                </>
              ) : null}

              <DescriptionTerm>Visibility</DescriptionTerm>
              <DescriptionDetails>
                <Badge color={channel.isPublic ? "blue" : "zinc"}>
                  {channel.isPublic ? "Public" : "Private"}
                </Badge>
              </DescriptionDetails>

              <DescriptionTerm>State</DescriptionTerm>
              <DescriptionDetails>
                <Badge color={badgeColor}>{stateLabel}</Badge>
              </DescriptionDetails>

              {channel.failureDetail ? (
                <>
                  <DescriptionTerm>Failure detail</DescriptionTerm>
                  <DescriptionDetails className="text-sm text-rose-700 dark:text-rose-300">
                    {channel.failureDetail}
                  </DescriptionDetails>
                </>
              ) : null}

              <DescriptionTerm>Capacity</DescriptionTerm>
              <DescriptionDetails className="font-semibold tabular-nums">
                {capacity} CKB
              </DescriptionDetails>

              {isReady ? (
                <>
                  <DescriptionTerm>
                    <span className="inline-flex items-center gap-1">
                      Can spend
                      <HelpTooltip content="How much you can send through this channel (your local balance)." />
                    </span>
                  </DescriptionTerm>
                  <DescriptionDetails className="tabular-nums">
                    {localBalance} CKB
                  </DescriptionDetails>

                  <DescriptionTerm>
                    <span className="inline-flex items-center gap-1">
                      Can receive
                      <HelpTooltip content="How much you can receive through this channel (the remote balance)." />
                    </span>
                  </DescriptionTerm>
                  <DescriptionDetails className="tabular-nums">
                    {remoteBalance} CKB
                  </DescriptionDetails>
                </>
              ) : null}
            </DescriptionList>

            {closeReason && !showAbandon ? (
              <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                {closeReason}
              </Text>
            ) : null}
            {abandonReason && showAbandon ? (
              <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                Abandon cancels a stuck open before funding completes on-chain.
              </Text>
            ) : null}
          </div>
        ) : step === "confirm-close" ? (
          <div className="space-y-4">
            <Text className="text-sm text-zinc-600 dark:text-zinc-400">
              Closing this channel returns funds to your on-chain wallet.
              Cooperative close requires the peer to be online.
            </Text>
            <div className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
              <span className="font-mono">{truncatePubkey(channel.pubkey)}</span>
              {" · "}
              {capacity} CKB
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Text className="text-sm text-zinc-600 dark:text-zinc-400">
              Abandon removes this opening attempt from your node. If funding
              never completed on-chain, your CKB stays in your wallet.
            </Text>
            <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <span className="font-mono">{truncatePubkey(channel.pubkey)}</span>
              {" · "}
              {stateLabel}
              {channel.failureDetail ? ` · ${channel.failureDetail}` : ""}
            </div>
          </div>
        )}

        {actionError ? (
          <PageErrorBanner
            className="mt-4"
            message={actionError}
            onDismiss={onClearError}
          />
        ) : null}
      </DialogBody>

      <DialogActions>
        {step === "detail" ? (
          <>
            <Button plain onClick={handleDismiss} disabled={isActing}>
              Done
            </Button>
            {showAbandon ? (
              <Button
                outline
                className="text-amber-800 dark:text-amber-300"
                onClick={() => {
                  onClearError()
                  setStep("confirm-abandon")
                }}
                disabled={isActing}
              >
                Abandon channel
              </Button>
            ) : (
              <Button
                outline
                className="text-red-700 dark:text-red-400"
                onClick={() => {
                  onClearError()
                  setStep("confirm-close")
                }}
                disabled={isActing || !canCloseChannel(channel.state)}
              >
                Close channel
              </Button>
            )}
          </>
        ) : step === "confirm-close" ? (
          <>
            <Button plain onClick={() => setStep("detail")} disabled={isActing}>
              Back
            </Button>
            <Button
              color="red"
              onClick={() => void handleConfirmClose()}
              disabled={isActing}
            >
              {isActing ? "Closing…" : "Confirm close"}
            </Button>
          </>
        ) : (
          <>
            <Button plain onClick={() => setStep("detail")} disabled={isActing}>
              Back
            </Button>
            <Button
              color="red"
              onClick={() => void handleConfirmAbandon()}
              disabled={isActing}
            >
              {isActing ? "Abandoning…" : "Confirm abandon"}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
