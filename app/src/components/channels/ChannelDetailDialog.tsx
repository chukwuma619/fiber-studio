import { useEffect, useState } from "react"
import {
  canAbandonChannel,
  canCloseChannel,
  canCooperativeCloseChannel,
  canForceCloseChannel,
  channelStateBadgeColor,
  channelStateDisplayLabel,
  defaultChannelCloseMethod,
  formatCkb,
  fundingTxHashFromOutpoint,
  parseHexU128,
  type ChannelCloseMethod,
} from "../../lib/fnn/format"
import {
  channelLiquidityHealth,
  healthBadgeColor,
} from "../../lib/fnn/liquidityHealth"
import type {
  AbandonChannelPayload,
  HomeChannel,
  ShutdownChannelPayload,
} from "../../lib/fnn/types"
import { truncatePubkey } from "../../lib/public-relays"
import { Badge } from "../ui/badge"
import { CapacityBar } from "../ui/capacity-bar"
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
import { Description, Label } from "../ui/fieldset"
import { HelpTooltip } from "../ui/help-tooltip"
import { PageErrorBanner } from "../ui/page-error-banner"
import { Radio, RadioField, RadioGroup } from "../ui/radio"
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
  onRebalance?: () => void
  rebalanceDisabledReason?: string | null
  onClearError: () => void
}

function channelCapacityDisplay(channel: HomeChannel): string {
  const total =
    parseHexU128(channel.localBalance) + parseHexU128(channel.remoteBalance)
  if (channel.assetSymbol === "CKB") {
    return `${formatCkb(total)} CKB`
  }
  return `${formatCkb(total)} ${channel.assetSymbol}`
}

function closeDisabledReason(channel: {
  state: string
  latestCommitmentTransactionHash?: string | null
  channelOutpoint?: string | null
}): string | null {
  if (channel.state === "ShuttingDown") {
    return "Cooperative close is already in progress. Force close if the peer is unresponsive."
  }
  if (channel.state === "Stale") {
    return "This channel needs to sync with its peer before it can be closed."
  }
  if (
    channel.state === "AwaitingChannelReady" &&
    canForceCloseChannel(channel)
  ) {
    return "This open never finished after funding. Force close to reclaim on-chain funds if the peer stays offline. Do not abandon — Fiber will reject it once funding is signed."
  }
  if (canAbandonChannel(channel)) {
    return "This channel is still opening. Abandon it instead of closing."
  }
  if (!canCloseChannel(channel)) {
    return "Only ready channels can be closed."
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
  onAbandonChannel,
  onRebalance,
  rebalanceDisabledReason,
  onClearError,
}: ChannelDetailDialogProps) {
  const [step, setStep] = useState<Step>("detail")
  const [closeMethod, setCloseMethod] = useState<ChannelCloseMethod>("cooperative")

  useEffect(() => {
    if (open) {
      setStep("detail")
      setCloseMethod(
        defaultChannelCloseMethod(
          channel ?? { state: "ChannelReady" },
        ),
      )
    }
  }, [open, channel?.channelId, channel?.state])

  if (!channel) {
    return null
  }

  const localBalance = channel.localBalanceDisplay
  const remoteBalance = channel.remoteBalanceDisplay
  const capacity = channelCapacityDisplay(channel)
  const fundingTxHash = fundingTxHashFromOutpoint(channel.channelOutpoint)
  const stateLabel = channelStateDisplayLabel(channel.state)
  const badgeColor = channelStateBadgeColor(
    channel.state,
    channel.localPercent,
  )
  const closeReason = closeDisabledReason(channel)
  const isReady = channel.state === "ChannelReady"
  const showClose = canCloseChannel(channel)
  const showAbandon = canAbandonChannel(channel)
  const cooperativeAllowed = canCooperativeCloseChannel(channel.state)
  const forceAllowed = canForceCloseChannel(channel)
  const isStuckFundedOpen =
    channel.state === "AwaitingChannelReady" && forceAllowed
  const channelId = channel.channelId
  const health = channelLiquidityHealth(channel)

  function handleDismiss() {
    setStep("detail")
    onClearError()
    onClose()
  }

  async function handleConfirmClose() {
    try {
      await onShutdownChannel({
        channelId,
        force: closeMethod === "force",
      })
      handleDismiss()
    } catch {
      // actionError is set by the hook
    }
  }

  function closeConfirmLabel(): string {
    switch (closeMethod) {
      case "force":
        return isActing ? "Force closing…" : "Confirm force close"
      case "cooperative":
        return isActing ? "Closing…" : "Confirm close"
      default: {
        const unreachable: never = closeMethod
        return unreachable
      }
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
                {capacity}
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
                    {localBalance}
                  </DescriptionDetails>

                  <DescriptionTerm>
                    <span className="inline-flex items-center gap-1">
                      Can receive
                      <HelpTooltip content="How much you can receive through this channel (the remote balance)." />
                    </span>
                  </DescriptionTerm>
                  <DescriptionDetails className="tabular-nums">
                    {remoteBalance}
                  </DescriptionDetails>

                  <DescriptionTerm>
                    <span className="inline-flex items-center gap-1">
                      Liquidity health
                      <HelpTooltip content={`${health.score}/100 toward a 50/50 split. ${health.description}`} />
                    </span>
                  </DescriptionTerm>
                  <DescriptionDetails>
                    <div className="space-y-2">
                      <CapacityBar percent={channel.localPercent} />
                      <Badge color={healthBadgeColor(health.kind)}>
                        {health.label}
                        {health.kind !== "pending" ? ` · ${health.score}/100` : ""}
                      </Badge>
                      {health.warning ? (
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          {health.description}
                        </p>
                      ) : null}
                    </div>
                  </DescriptionDetails>
                </>
              ) : null}
            </DescriptionList>

            {rebalanceDisabledReason && isReady ? (
              <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                {rebalanceDisabledReason}
              </Text>
            ) : null}
            {closeReason && showClose ? (
              <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                {closeReason}
              </Text>
            ) : null}
            {showAbandon ? (
              <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                Abandon cancels a stuck open before funding is signed on-chain.
              </Text>
            ) : null}
          </div>
        ) : step === "confirm-close" ? (
          <div className="space-y-4">
            <Text className="text-sm text-zinc-600 dark:text-zinc-400">
              {isStuckFundedOpen
                ? "This channel funded on-chain but never became ready. Cooperative close cannot run. Force close broadcasts the latest commitment and returns funds after confirmation."
                : "Closing returns funds to your on-chain wallet. Fiber has two close methods."}
            </Text>
            <RadioGroup
              value={closeMethod}
              onChange={(value) => {
                if (value === "cooperative" || value === "force") {
                  setCloseMethod(value)
                }
              }}
              disabled={isActing}
            >
              <RadioField disabled={!cooperativeAllowed}>
                <Radio value="cooperative" />
                <Label>Cooperative close</Label>
                <Description>
                  Peer must be online. Both sides sign a joint closing
                  transaction.
                </Description>
              </RadioField>
              <RadioField disabled={!forceAllowed}>
                <Radio value="force" color="red" />
                <Label>Force close</Label>
                <Description>
                  Unilateral close if the peer is offline. Broadcasts the
                  latest commitment; funds may take longer to become spendable.
                </Description>
              </RadioField>
            </RadioGroup>
            <div
              className={
                closeMethod === "force"
                  ? "rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                  : "rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300"
              }
            >
              <span className="font-mono">{truncatePubkey(channel.pubkey)}</span>
              {" · "}
              {capacity}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Text className="text-sm text-zinc-600 dark:text-zinc-400">
              Abandon removes this opening attempt from your node. If funding
              never completed on-chain, your funds stay in your wallet.
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
            {onRebalance ? (
              <Button
                outline
                onClick={() => {
                  onClearError()
                  onRebalance()
                }}
                disabled={isActing || Boolean(rebalanceDisabledReason)}
              >
                Rebalance
              </Button>
            ) : null}
            {showClose ? (
              <Button
                outline
                className="text-red-700 dark:text-red-400"
                onClick={() => {
                  onClearError()
                  setCloseMethod(defaultChannelCloseMethod(channel))
                  setStep("confirm-close")
                }}
                disabled={isActing}
              >
                Close channel
              </Button>
            ) : null}
            {showAbandon ? (
              <Button
                plain
                className="text-amber-800 dark:text-amber-300"
                onClick={() => {
                  onClearError()
                  setStep("confirm-abandon")
                }}
                disabled={isActing}
              >
                Abandon channel
              </Button>
            ) : null}
            <Button onClick={handleDismiss} disabled={isActing}>
              Done
            </Button>
          </>
        ) : step === "confirm-close" ? (
          <>
            <Button plain onClick={() => setStep("detail")} disabled={isActing}>
              Back
            </Button>
            <Button
              color="red"
              onClick={() => void handleConfirmClose()}
              disabled={
                isActing ||
                (closeMethod === "cooperative" && !cooperativeAllowed) ||
                (closeMethod === "force" && !forceAllowed)
              }
            >
              {closeConfirmLabel()}
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
