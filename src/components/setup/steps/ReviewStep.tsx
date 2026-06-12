import { joinDataPath } from "../../../lib/data-directory"
import {
  getRelay,
  PUBLIC_CHANNEL_FUNDING_CKB,
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

  const rows: ReviewRow[] = [
    { label: "Network", value: config.network },
    {
      label: "Connect peer",
      value: config.customPublicNodePubkey
        ? relayLabel
          ? `${relayLabel} · ${truncatePubkey(config.customPublicNodePubkey)}`
          : truncatePubkey(config.customPublicNodePubkey)
        : "Not set",
      mono: true,
    },
    ...(config.customPublicNodeMultiaddr
      ? [
          {
            label: "Multiaddr",
            value: config.customPublicNodeMultiaddr,
            mono: true,
          },
        ]
      : []),
    {
      label: "Saved peer",
      value: config.customPublicNodePubkey
        ? `For dashboard · ${truncatePubkey(config.customPublicNodePubkey)}`
        : "Not set",
      mono: true,
    },
    {
      label: "Channel plan",
      value: `Open from dashboard · ${PUBLIC_CHANNEL_FUNDING_CKB} CKB · public`,
    },
    { label: "Data directory", value: config.dataDirectory, mono: true },
    {
      label: "Wallet key",
      value:
        config.keyFileMode === "import"
          ? config.importedPrivateKey
            ? `Private key → ${joinDataPath(config.dataDirectory, "ckb", "key")}`
            : "Not entered"
          : joinDataPath(config.dataDirectory, config.keyFilePath),
      mono: true,
    },
    {
      label: "Key password",
      value: config.password ? "••••••••" : "Not set",
    },
    {
      label: "Environment",
      value: "FIBER_SECRET_KEY_PASSWORD → keychain",
      mono: true,
    },
  ]

  return (
    <div className="space-y-4">
      <div>
        <Heading level={2}>Review & start</Heading>
        <Text className="mt-1">
          Confirm your setup before starting the local fnn node.
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

      <Text className="text-xs">
        Clicking Start node will provision your data directory, store your
        password in the OS keychain, and launch the bundled fnn binary. Connect
        to your saved peer and open a channel from the dashboard when you are
        ready.
      </Text>

      {startError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/30">
          <Text className="text-sm text-red-700 dark:text-red-300">
            {startError}
          </Text>
        </div>
      ) : null}
    </div>
  )
}
