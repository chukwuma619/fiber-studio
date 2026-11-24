import { describe, expect, it } from "vitest"
import { getErrorMessage, parseMigrationRequiredError } from "./errors"

describe("getErrorMessage", () => {
  it("reads an Error, a string, or anything else", () => {
    expect(getErrorMessage(new Error("fnn RPC error: (-1) denied"))).toBe("denied")
    expect(getErrorMessage("plain failure")).toBe("plain failure")
    expect(getErrorMessage(42)).toBe("42")
  })
})

describe("parseMigrationRequiredError", () => {
  it("reads the migration prefix the node process emits", () => {
    expect(
      parseMigrationRequiredError(
        "MIGRATION_REQUIRED:Database migration required|breaking_change=true",
      ),
    ).toEqual({
      message: "Database migration required",
      hasBreakingChange: true,
    })
    expect(
      parseMigrationRequiredError(
        new Error("MIGRATION_REQUIRED:Backup recommended"),
      ),
    ).toEqual({
      message: "Backup recommended",
      hasBreakingChange: false,
    })
  })

  it("ignores ordinary startup failures", () => {
    expect(parseMigrationRequiredError("node failed to start")).toBeNull()
    expect(parseMigrationRequiredError(new Error("port in use"))).toBeNull()
  })
})
