import { useState } from "react"
import { useChannelNeighborhood } from "../../lib/fnn/useChannelNeighborhood"
import { pubkeysEqual } from "../../lib/fnn/relay"
import { HomeEmptyState } from "../home/HomeEmptyState"
import { Subheading } from "../ui/heading"
import { Text } from "../ui/text"
import { NeighborhoodMesh } from "./NeighborhoodMesh"

type NeighborhoodSectionProps = {
  running: boolean
  graphReady: boolean
  reloadToken: number
}

export function NeighborhoodSection({
  running,
  graphReady,
  reloadToken,
}: NeighborhoodSectionProps) {
  const [expandedPubkey, setExpandedPubkey] = useState<string | null>(null)
  const neighborhood = useChannelNeighborhood(running, expandedPubkey, reloadToken)
  const data = neighborhood.data

  return (
    <section className="overflow-hidden rounded-lg bg-white shadow-xs ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10">
      <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <Subheading level={2}>Your neighborhood</Subheading>
      </div>

      {neighborhood.error ? (
        <div className="border-b border-zinc-200 px-5 py-3 text-sm text-red-700 dark:border-zinc-800 dark:text-red-300">
          Failed to load neighborhood: {neighborhood.error}
        </div>
      ) : null}

      {data?.graphPartial ? (
        <div className="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <Text className="text-xs text-amber-700 dark:text-amber-400">
            Showing public channels found in the synced graph. The list may be
            incomplete.
          </Text>
        </div>
      ) : null}

      {!data && neighborhood.isLoading ? (
        <div className="px-5 py-4 text-sm text-zinc-500 dark:text-zinc-400">
          Loading neighborhood…
        </div>
      ) : null}

      {data && data.peers.length === 0 ? (
        <HomeEmptyState
          title="No ready channels yet"
          description="Open channels show up here after they finish opening."
        />
      ) : null}

      {data && data.peers.length > 0 ? (
        <NeighborhoodMesh
          selfLabel={data.selfLabel}
          peers={data.peers}
          expanded={data.expanded}
          expandedPubkey={expandedPubkey}
          isLoading={neighborhood.isLoading}
          graphReady={graphReady}
          onToggle={(pubkey) =>
            setExpandedPubkey((current) =>
              current && pubkeysEqual(current, pubkey) ? null : pubkey,
            )
          }
        />
      ) : null}
    </section>
  )
}
