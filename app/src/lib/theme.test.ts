/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it } from "vitest"
import { applyTheme, getStoredTheme, resolveDark } from "./theme"

function stubMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  })
}

describe("theme", () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove("dark")
    stubMatchMedia(false)
  })

  it("defaults to the system theme", () => {
    localStorage.setItem("theme", "nope")
    expect(getStoredTheme()).toBe("system")
    localStorage.setItem("theme", "dark")
    expect(getStoredTheme()).toBe("dark")
  })

  it("follows the system preference only for the system theme", () => {
    stubMatchMedia(true)
    expect(resolveDark("system")).toBe(true)
    expect(resolveDark("light")).toBe(false)
    expect(resolveDark("dark")).toBe(true)
  })

  it("persists an explicit theme and clears storage for system", () => {
    applyTheme("dark")
    expect(localStorage.getItem("theme")).toBe("dark")
    expect(document.documentElement.classList.contains("dark")).toBe(true)

    applyTheme("system")
    expect(localStorage.getItem("theme")).toBeNull()
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })
})
