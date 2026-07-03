import type { ReactNode } from "react"
import {
  getDataDirectoryDisplayForNetwork,
  joinDataPath,
} from "../../../lib/data-directory"
import { parseSetupStartError } from "../../../lib/setup/errors"
import type { SetupConfig } from "../../../lib/setup/types"
import { truncatePubkey } from "../../../lib/public-relays"
import { CopyButton } from "../../ui/copy-button"
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
} from "../../ui/description-list"
import { Heading } from "../../ui/heading"
import { Text } from "../../ui/text"

type ReviewRow = {
  label: string
  value: ReactNode
  mono?: boolean
}

export function ReviewStep({
  config,
  startError,
}: {
  config: SetupConfig
  startError?: string | null
}) {
  const peerPubkey = config.customPublicNodePubkey.trim()
  const walletKeyPath = joinDataPath(
    getDataDirectoryDisplayForNetwork(config.network),
    "ckb",
    "key",
  )

  const rows: ReviewRow[] = [
    {
      label: "Network",
      value: config.network === "mainnet" ? "Mainnet" : "Testnet",
    },
    {
      label: "Peer",
      value: peerPubkey ? (
        <span className="flex min-w-0 items-center gap-1">
          <span className="truncate" title={peerPubkey}>
            {truncatePubkey(peerPubkey)}
          </span>
          <CopyButton
            value={peerPubkey}
            label="Copy peer pubkey"
            className="shrink-0"
          />
        </span>
      ) : (
        "Not set"
      ),
      mono: Boolean(peerPubkey),
    },
    { label: "Data directory", value: config.dataDirectory, mono: true },
    {
      label: "Wallet key",
      value: config.importedPrivateKey
        ? `Will be saved to ${walletKeyPath}`
        : "Not entered",
      mono: Boolean(config.importedPrivateKey),
    },
    {
      label: "Password",
      value: config.password
        ? "Will be stored in OS keychain when you start"
        : "Not set",
    },
  ]

  const parsedError = startError ? parseSetupStartError(startError) : null

  return (
    <div className="space-y-4">
      <div>
        <Heading level={2} tabIndex={-1}>Review & start</Heading>
        <Text className="mt-1">Check your choices, then start your node.</Text>
      </div>

      <DescriptionList>
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <DescriptionTerm>{row.label}</DescriptionTerm>
            <DescriptionDetails
              className={
                row.mono
                  ? "min-w-0 break-all font-mono text-xs text-zinc-500"
                  : undefined
              }
            >
              {row.value}
            </DescriptionDetails>
          </div>
        ))}
      </DescriptionList>

      {parsedError ? (
        <div
          role="alert"
          className="rounded-lg bg-red-500/10 px-4 py-3 ring-1 ring-red-500/20 dark:bg-red-500/10 dark:ring-red-500/20"
        >
          <Text className="text-sm font-medium text-red-800 dark:text-red-200">
            {parsedError.title}
          </Text>
          {parsedError.hint ? (
            <Text className="mt-1 text-sm text-red-700 dark:text-red-300">
              {parsedError.hint}
            </Text>
          ) : null}
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-red-600 underline decoration-red-400/60 underline-offset-2 dark:text-red-400">
              Technical details
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-red-700 dark:text-red-300">
              {parsedError.details}
            </pre>
          </details>
        </div>
      ) : null}
    </div>
  )
}
