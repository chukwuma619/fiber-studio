import { FNN_VERSION } from "../../lib/fnn/types"
import { truncatePubkey } from "../../lib/public-relays"
import type { HomeDashboardResponse, NodeStatusState } from "../../lib/fnn/types"
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
} from "../ui/description-list"
import { Subheading } from "../ui/heading"
import { StatusDot } from "../layout/StatusDot"
import { nodeStatusDotTone } from "../../lib/fnn/useNodeControl"

const FNN_RPC_ENDPOINT = "127.0.0.1:8227"

type NodeStatusPanelProps = {
  dashboard: HomeDashboardResponse | null
  status: NodeStatusState | null
  isLoading: boolean
}

function runtimeStatusLabel(status: NodeStatusState | null, isLoading: boolean): string {
  if (isLoading || !status) return "Loading…"

  switch (status.state) {
    case "running":
      return "Running"
    case "stopped":
      return "Stopped"
    case "starting":
      return "Starting"
    case "error":
      return "Error"
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

export function NodeStatusPanel({
  dashboard,
  status,
  isLoading,
}: NodeStatusPanelProps) {
  const dotTone = nodeStatusDotTone(status, isLoading)
  const version = dashboard?.nodeInfo?.version ?? (status?.state === "running" ? status.version : FNN_VERSION)
  const pubkey =
    dashboard?.nodeInfo?.pubkey ??
    (status?.state === "running" ? status.pubkey : null)

  return (
    <section className="min-w-0 rounded-lg bg-white p-6 shadow-xs ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10">
        <Subheading level={3}>Node status</Subheading>

        <DescriptionList className="mt-4">
          <DescriptionTerm>Status</DescriptionTerm>
          <DescriptionDetails>
            <span className="inline-flex items-center gap-1.5">
              <StatusDot tone={dotTone} />
              {runtimeStatusLabel(status, isLoading)}
            </span>
          </DescriptionDetails>

          <DescriptionTerm>fnn version</DescriptionTerm>
          <DescriptionDetails>{version}</DescriptionDetails>

          {pubkey ? (
            <>
              <DescriptionTerm>Node pubkey</DescriptionTerm>
              <DescriptionDetails className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                {truncatePubkey(pubkey)}
              </DescriptionDetails>
            </>
          ) : null}

          <DescriptionTerm>RPC</DescriptionTerm>
          <DescriptionDetails className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
            {FNN_RPC_ENDPOINT}
          </DescriptionDetails>
        </DescriptionList>
    </section>
  )
}
