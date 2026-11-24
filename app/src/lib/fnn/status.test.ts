import { describe, expect, it } from "vitest"
import {
  formatNodeStatusLabel,
  formatNodeStatusLabelFromResponse,
  isNodeRunning,
  isNodeStopped,
} from "./status"
import type { NodeStatusResponse } from "./types"

describe("node status", () => {
  const running = {
    state: "running" as const,
    version: "0.10.0",
    pubkey: "02aa",
  }

  it("narrows the running state and recognizes stopped", () => {
    expect(isNodeRunning(running)).toBe(true)
    expect(isNodeRunning({ state: "starting" })).toBe(false)
    expect(isNodeStopped({ state: "stopped" })).toBe(true)
    expect(isNodeStopped({ state: "error", message: "boom" })).toBe(false)
  })

  it("labels each state and the loading response", () => {
    expect(formatNodeStatusLabel({ state: "stopped" })).toBe("Stopped")
    expect(formatNodeStatusLabel({ state: "starting" })).toBe("Starting")
    expect(formatNodeStatusLabel(running)).toBe("Running")
    expect(formatNodeStatusLabel({ state: "error", message: "boom" })).toBe(
      "Error",
    )

    const response: NodeStatusResponse = {
      status: running,
      dataDirectory: "/tmp/fiber",
      recentLogs: [],
    }
    expect(formatNodeStatusLabelFromResponse(null, true)).toBe("Loading…")
    expect(formatNodeStatusLabelFromResponse(null, false)).toBe("Loading…")
    expect(formatNodeStatusLabelFromResponse(response, false)).toBe("Running")
  })
})
