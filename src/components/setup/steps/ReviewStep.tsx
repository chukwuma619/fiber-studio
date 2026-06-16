import {
  getRelay,
  truncatePubkey,
} from "../../../lib/public-relays"
import type { SetupConfig } from "../../../lib/setup/types"
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
} from "../../ui/description-list"
import { Heading } from "../../ui/heading"
import { Text } from "../../ui/text"

function relayLabelForPubkey(
  network: SetupConfig["network"],
  pubkey: string,
): string | null {
  const node1 = getRelay(network, "node1")
  const node2 = getRelay(network, "node2")
  if (pubkey === node1.pubkey) return "node1"
  if (pubkey === node2.pubkey) return "node2"
  return null
}

type ReviewRow = {
  label: string
  value: string
  mono?: boolean
}

export function ReviewStep({
  config,
  startError,
}: {
  config: SetupConfig
  startError?: string | null
}) {
  const relayLabel = relayLabelForPubkey(
    config.network,
    config.customPublicNodePubkey,
  )

  const peerValue = config.customPublicNodePubkey
    ? relayLabel
      ? `Public ${relayLabel} · ${truncatePubkey(config.customPublicNodePubkey)}`
      : truncatePubkey(config.customPublicNodePubkey)
    : "Not set"

  const rows: ReviewRow[] = [
    {
      label: "Network",
      value: config.network === "mainnet" ? "Mainnet" : "Testnet",
    },
    {
      label: "Peer",
      value: peerValue,
      mono: Boolean(config.customPublicNodePubkey),
    },
    { label: "Data directory", value: config.dataDirectory, mono: true },
    {
      label: "Wallet key",
      value: config.importedPrivateKey ? "Entered" : "Not entered",
    },
    {
      label: "Password",
      value: config.password ? "Set" : "Not set",
    },
  ]

  return (
    <div className="space-y-4">
      <div>
        <Heading level={2}>Review & start</Heading>
        <Text className="mt-1">
          Check your choices, then start your local node.
        </Text>
      </div>

      <DescriptionList>
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <DescriptionTerm>{row.label}</DescriptionTerm>
            <DescriptionDetails
              className={row.mono ? "font-mono text-xs text-zinc-500" : undefined}
            >
              {row.value}
            </DescriptionDetails>
          </div>
        ))}
      </DescriptionList>

      <Text className="text-xs text-zinc-500 dark:text-zinc-400">
        Fiber Studio will set up your data folder and launch fnn on this
        computer.
      </Text>

      {startError ? (
        <div className="rounded-lg bg-red-500/10 px-4 py-3 ring-1 ring-red-500/20 dark:bg-red-500/10 dark:ring-red-500/20">
          <Text className="text-sm text-red-700 dark:text-red-300">
            {startError}
          </Text>
        </div>
      ) : null}
    </div>
  )
}
