import type { NodeStatusResponse, NodeStatusState } from "./types"

export function isNodeRunning(
  status: NodeStatusState,
): status is { state: "running"; version: string; pubkey: string } {
  return status.state === "running"
}

export function isNodeStopped(status: NodeStatusState): boolean {
  return status.state === "stopped"
}

export function formatNodeStatusLabel(status: NodeStatusState): string {
  switch (status.state) {
    case "stopped":
      return "Stopped"
    case "starting":
      return "Starting"
    case "running":
      return "Running"
    case "error":
      return "Error"
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

export function formatNodeStatusLabelFromResponse(
  response: NodeStatusResponse | null,
  isLoading: boolean,
): string {
  if (isLoading || !response) return "Loading…"
  return formatNodeStatusLabel(response.status)
}
