import type { NetworkRelayEntry } from "../../lib/fnn/types"
import { truncatePubkey } from "../../lib/public-relays"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
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
    <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-950 dark:text-white">
            {relay.label}
          </p>
          <span className="mt-1 block">
            <Badge color="zinc">{networkLabel}</Badge>
            {relay.isConfigured ? (
              <Badge color="blue" className="ml-1.5">
                Configured
              </Badge>
            ) : null}
          </span>
        </div>
        <Badge color={connected ? "green" : "zinc"}>
          <StatusDot tone={connected ? "running" : "stopped"} />
          {connected ? "Connected" : "Not connected"}
        </Badge>
      </div>

      <p className="mt-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
        {truncatePubkey(relay.pubkey)}
      </p>

      {relay.channelCount > 0 ? (
        <Text className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {relay.channelCount} channel{relay.channelCount === 1 ? "" : "s"}
        </Text>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          outline
          className="text-xs"
          onClick={onConnect}
          disabled={disabled || isActing || connected}
        >
          {isActing && !connected ? "Connecting…" : "Connect"}
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
