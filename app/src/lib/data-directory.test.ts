import { describe, expect, it } from "vitest"
import {
  getDataDirectoryDirName,
  isLegacyDataDirectoryPath,
  joinDataPath,
} from "./data-directory"

describe("data directory", () => {
  it("names the folder after the network", () => {
    expect(getDataDirectoryDirName("testnet")).toBe("fiber-studio-testnet")
    expect(getDataDirectoryDirName("mainnet")).toBe("fiber-studio-mainnet")
  })

  it("recognizes the old single-network folder on either slash style", () => {
    expect(isLegacyDataDirectoryPath("~/Library/fiber-studio")).toBe(true)
    expect(isLegacyDataDirectoryPath("~/Library/fiber-studio/")).toBe(true)
    expect(
      isLegacyDataDirectoryPath("~\\AppData\\Roaming\\fiber-studio"),
    ).toBe(true)
    expect(isLegacyDataDirectoryPath("~/.local/share/fiber-studio-testnet")).toBe(
      false,
    )
    expect(isLegacyDataDirectoryPath("~/.local/share/fiber-studio-mainnet")).toBe(
      false,
    )
    expect(isLegacyDataDirectoryPath("fiber-studio")).toBe(false)
  })

  it("joins segments with the platform separator and strips a trailing slash", () => {
    expect(joinDataPath("/tmp/fiber-studio-testnet/", "fnn", "config.yml")).toBe(
      "/tmp/fiber-studio-testnet/fnn/config.yml",
    )
  })
})
