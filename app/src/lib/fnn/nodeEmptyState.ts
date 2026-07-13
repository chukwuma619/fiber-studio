import type { NodeStatusState } from "./types"

export type NodeEmptyStateCopy = {
  title: string
  description: string
}

export function nodeUnavailableEmptyState(
  status: NodeStatusState | null,
  whenStoppedDescription: string,
): NodeEmptyStateCopy {
  switch (status?.state) {
    case "starting":
      return {
        title: "Node starting…",
        description: "Data will appear once fnn finishes starting.",
      }
    case "error":
      return {
        title: "Node error",
        description: "Check node logs for details, then try restarting.",
      }
    case "stopped":
      return {
        title: "Node stopped",
        description: whenStoppedDescription,
      }
    default:
      return {
        title: "Node not running",
        description: whenStoppedDescription,
      }
  }
}

export function nodeDataEmptyState(
  status: NodeStatusState | null,
  available: boolean,
  whenStoppedDescription: string,
  whenUnavailableDescription = "Your node is running but data could not be loaded. Try refreshing.",
): NodeEmptyStateCopy | null {
  if (available) {
    return null
  }

  if (status?.state === "running") {
    return {
      title: "Data unavailable",
      description: whenUnavailableDescription,
    }
  }

  return nodeUnavailableEmptyState(status, whenStoppedDescription)
}
