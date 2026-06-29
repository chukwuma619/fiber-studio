import type { NetworkRelayEntry } from "../../lib/fnn/types"
import { truncatePubkey } from "../../lib/public-relays"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { CopyButton } from "../ui/copy-button"
import { StatusDot } from "../layout/StatusDot"
import { Text } from "../ui/text"

type RelayCardProps = {
  relay: NetworkRelayEntry
  networkLabel: string
  disabled: boolean
  isActing: boolean
  onConnect: () => void
  onOpenChannel: () => void
}

function primaryPeerButtonLabel(isActing: boolean, isConfigured: boolean): string {
  if (isConfigured) return "Primary peer"
  if (isActing) return "Saving…"
  return "Set as primary"
}

export function RelayCard({
  relay,
  networkLabel,
  disabled,
  isActing,
  onConnect,
  onOpenChannel,
}: RelayCardProps) {
  const connected = relay.connected

  return (
    <div className="flex h-full flex-col rounded-lg bg-zinc-50 p-4 ring-1 ring-zinc-950/5 dark:bg-zinc-950/40 dark:ring-white/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <p
              className="font-mono text-sm font-semibold text-zinc-950 dark:text-white"
              title={relay.pubkey}
            >
              {truncatePubkey(relay.pubkey)}
            </p>
            <CopyButton value={relay.pubkey} label="Copy peer pubkey" />
          </div>
          <span className="mt-1 block">
            <Badge color="zinc">{networkLabel}</Badge>
            {relay.isConfigured ? (
              <Badge color="blue" className="ml-1.5">
                Primary
              </Badge>
            ) : null}
          </span>
        </div>
        <Badge color={connected ? "green" : "zinc"}>
          <StatusDot tone={connected ? "running" : "stopped"} />
          {connected ? "In peer list" : "Not connected"}
        </Badge>
      </div>

      {relay.channelCount > 0 ? (
        <Text className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {relay.channelCount} channel{relay.channelCount === 1 ? "" : "s"} with
          this peer
        </Text>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <Button
          outline
          className="text-xs"
          onClick={onConnect}
          disabled={disabled || isActing || relay.isConfigured}
        >
          {primaryPeerButtonLabel(isActing, relay.isConfigured)}
        </Button>
        <Button
          plain
          className="text-xs"
          onClick={onOpenChannel}
          disabled={disabled || isActing}
        >
          Open channel
        </Button>
      </div>
    </div>
  )
}
