import { useEffect, useState } from "react"
import {
  channelStateBadgeColor,
  channelStateDisplayLabel,
  formatCkb,
  parseHexU128,
} from "../../lib/fnn/format"
import type { HomeChannel, ShutdownChannelPayload } from "../../lib/fnn/types"
import { truncatePubkey } from "../../lib/public-relays"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { CapacityBar } from "../ui/capacity-bar"
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
} from "../ui/description-list"
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog"
import { Text } from "../ui/text"

type Step = "detail" | "confirm-close"

type ChannelDetailDialogProps = {
  open: boolean
  channel: HomeChannel | null
  onClose: () => void
  isActing: boolean
  actionError: string | null
  onShutdownChannel: (payload: ShutdownChannelPayload) => Promise<void>
  onClearError: () => void
}

function canCloseChannel(state: string): boolean {
  return state === "ChannelReady"
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

export function ChannelDetailDialog({
  open,
  channel,
  onClose,
  isActing,
  actionError,
  onShutdownChannel,
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
  const remotePercent = Math.max(0, 100 - channel.localPercent)
  const stateLabel = channelStateDisplayLabel(channel.state)
  const badgeColor = channelStateBadgeColor(
    channel.state,
    channel.localPercent,
  )
  const closeReason = closeDisabledReason(channel.state)
  const isReady = channel.state === "ChannelReady"

  function handleDismiss() {
    setStep("detail")
    onClearError()
    onClose()
  }

  async function handleConfirmClose() {
    try {
      await onShutdownChannel({ channelId: channel.channelId })
      handleDismiss()
    } catch {
      // actionError is set by the hook
    }
  }

  return (
    <Dialog
      open={open}
      onClose={isActing ? () => {} : handleDismiss}
      size="lg"
    >
      <DialogTitle>
        {step === "detail" ? "Channel details" : "Close channel"}
      </DialogTitle>
      <DialogDescription>
        {step === "detail"
          ? `Channel with ${truncatePubkey(channel.pubkey)}.`
          : "Cooperative close returns funds to your on-chain CKB wallet."}
      </DialogDescription>

      <DialogBody>
        {step === "detail" ? (
          <div className="space-y-6">
            <DescriptionList>
              <DescriptionTerm>Peer pubkey</DescriptionTerm>
              <DescriptionDetails className="font-mono text-xs break-all text-zinc-600 dark:text-zinc-300">
                {channel.pubkey}
              </DescriptionDetails>

              <DescriptionTerm>Channel ID</DescriptionTerm>
              <DescriptionDetails className="font-mono text-xs break-all text-zinc-600 dark:text-zinc-300">
                {channel.channelId}
              </DescriptionDetails>

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

              <DescriptionTerm>Capacity</DescriptionTerm>
              <DescriptionDetails className="font-semibold tabular-nums">
                {capacity} CKB
              </DescriptionDetails>

              {isReady ? (
                <>
                  <DescriptionTerm>Local balance</DescriptionTerm>
                  <DescriptionDetails className="tabular-nums">
                    {localBalance} CKB
                  </DescriptionDetails>

                  <DescriptionTerm>Remote balance</DescriptionTerm>
                  <DescriptionDetails className="tabular-nums">
                    {remoteBalance} CKB
                  </DescriptionDetails>
                </>
              ) : null}
            </DescriptionList>

            <div className="border-t border-zinc-950/5 pt-4 dark:border-white/5">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Liquidity
              </p>
              {isReady ? (
                <div className="mt-3 space-y-2">
                  <CapacityBar percent={channel.localPercent} showLabel={false} />
                  <p className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                    {channel.localPercent}% local / {remotePercent}% remote
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  Not available until ready.
                </p>
              )}
            </div>

            {closeReason ? (
              <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                {closeReason}
              </Text>
            ) : null}
          </div>
        ) : (
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
        )}

        {actionError ? (
          <Text className="mt-4 text-sm text-red-600 dark:text-red-400">
            {actionError}
          </Text>
        ) : null}
      </DialogBody>

      <DialogActions>
        {step === "detail" ? (
          <>
            <Button plain onClick={handleDismiss} disabled={isActing}>
              Done
            </Button>
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
          </>
        ) : (
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
        )}
      </DialogActions>
    </Dialog>
  )
}
