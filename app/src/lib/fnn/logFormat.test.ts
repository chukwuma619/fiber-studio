import { describe, expect, it } from "vitest"
import { formatLogLines, stripAnsi } from "./logFormat"

describe("log formatting", () => {
  it("strips color codes and trailing space", () => {
    expect(stripAnsi("\u001b[31merror\u001b[0m  ")).toBe("error")
    expect(stripAnsi("plain")).toBe("plain")
  })

  it("drops blank lines after stripping", () => {
    expect(
      formatLogLines(["\u001b[32mready\u001b[0m", "   ", "listening"]),
    ).toBe("ready\nlistening")
  })
})
