/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it } from "vitest"
import {
  dismissForSession,
  isSessionDismissed,
  isVersionSkipped,
  skipVersion,
} from "./updatePreferences"

describe("update preferences", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it("skips only the version the user dismissed", () => {
    expect(isVersionSkipped("1.2.0")).toBe(false)
    skipVersion("1.2.0")
    expect(isVersionSkipped("1.2.0")).toBe(true)
    expect(isVersionSkipped("1.2.1")).toBe(false)
  })

  it("dismisses the prompt for the current session only", () => {
    expect(isSessionDismissed()).toBe(false)
    dismissForSession()
    expect(isSessionDismissed()).toBe(true)
    expect(localStorage.getItem("fiber-studio:update-session-dismissed")).toBeNull()
  })
})
