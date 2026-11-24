import { describe, expect, it } from "vitest"
import { nodeDataEmptyState, nodeUnavailableEmptyState } from "./nodeEmptyState"

const STOPPED = "Start the node to load this page."

describe("node empty states", () => {
  it("explains why the node cannot show data yet", () => {
    expect(nodeUnavailableEmptyState({ state: "starting" }, STOPPED)).toEqual({
      title: "Node starting…",
      description: "Data will appear once fnn finishes starting.",
    })
    expect(
      nodeUnavailableEmptyState({ state: "error", message: "x" }, STOPPED).title,
    ).toBe("Node error")
    expect(nodeUnavailableEmptyState({ state: "stopped" }, STOPPED)).toEqual({
      title: "Node stopped",
      description: STOPPED,
    })
    expect(nodeUnavailableEmptyState(null, STOPPED).title).toBe(
      "Node not running",
    )
  })

  it("hides the empty state when data is available", () => {
    expect(
      nodeDataEmptyState(
        { state: "running", version: "0.10.0", pubkey: "02aa" },
        true,
        STOPPED,
      ),
    ).toBeNull()
  })

  it("distinguishes a running node with missing data from a stopped node", () => {
    expect(
      nodeDataEmptyState(
        { state: "running", version: "0.10.0", pubkey: "02aa" },
        false,
        STOPPED,
      ),
    ).toEqual({
      title: "Data unavailable",
      description:
        "Your node is running but data could not be loaded. Try refreshing.",
    })
    expect(
      nodeDataEmptyState({ state: "stopped" }, false, STOPPED, "custom"),
    ).toEqual({
      title: "Node stopped",
      description: STOPPED,
    })
  })
})
