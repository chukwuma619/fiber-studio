import { describe, expect, it } from "vitest"
import { getNavItemById, isNavItemActive, NAV_ITEMS } from "./nav"

describe("navigation", () => {
  it("includes every primary and advanced page once", () => {
    expect(NAV_ITEMS.map((item) => item.id)).toEqual([
      "home",
      "payments",
      "assets",
      "settings",
      "channels",
      "network",
    ])
    expect(new Set(NAV_ITEMS.map((item) => item.href)).size).toBe(NAV_ITEMS.length)
  })

  it("matches a route without treating a prefix as a different page", () => {
    expect(isNavItemActive("/", "/")).toBe(true)
    expect(isNavItemActive("/payments", "/")).toBe(false)
    expect(isNavItemActive("/channels", "/channels")).toBe(true)
    expect(isNavItemActive("/channels/abc", "/channels")).toBe(true)
    expect(isNavItemActive("/channels-extra", "/channels")).toBe(false)
    expect(isNavItemActive("/channel", "/channels")).toBe(false)
  })

  it("looks up a known item and rejects an unknown id", () => {
    expect(getNavItemById("payments").href).toBe("/payments")
    expect(() => getNavItemById("missing" as never)).toThrow(/Unknown nav item/)
  })
})
