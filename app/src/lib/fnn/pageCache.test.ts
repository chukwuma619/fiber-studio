import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getPageCache, invalidatePageCaches, setPageCache } from "./pageCache"

describe("page cache", () => {
  beforeEach(() => {
    invalidatePageCaches()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-01T00:00:00Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns a fresh entry and drops it after the ttl", () => {
    setPageCache("page:home", { balance: 1 })
    expect(getPageCache("page:home")).toEqual({ balance: 1 })

    vi.advanceTimersByTime(8_000)
    expect(getPageCache("page:home")).toEqual({ balance: 1 })

    vi.advanceTimersByTime(1)
    expect(getPageCache("page:home")).toBeNull()
    expect(getPageCache("page:home", 60_000)).toBeNull()
  })

  it("honors a caller-supplied ttl", () => {
    setPageCache("page:payments", ["a"])
    vi.advanceTimersByTime(500)
    expect(getPageCache("page:payments", 400)).toBeNull()
  })

  it("clears one key or the whole store", () => {
    setPageCache("page:home", 1)
    setPageCache("page:channels", 2)
    invalidatePageCaches("page:home")
    expect(getPageCache("page:home")).toBeNull()
    expect(getPageCache("page:channels")).toBe(2)

    invalidatePageCaches()
    expect(getPageCache("page:channels")).toBeNull()
  })
})
