/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it } from "vitest"
import {
  getLaunchAtLogin,
  getStartNodeOnLaunch,
  setLaunchAtLogin,
  setStartNodeOnLaunch,
} from "./appPreferences"

describe("app preferences", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("defaults both launch options off", () => {
    expect(getStartNodeOnLaunch()).toBe(false)
    expect(getLaunchAtLogin()).toBe(false)
  })

  it("round-trips booleans and ignores unknown stored values", () => {
    setStartNodeOnLaunch(true)
    setLaunchAtLogin(false)
    expect(getStartNodeOnLaunch()).toBe(true)
    expect(getLaunchAtLogin()).toBe(false)

    localStorage.setItem("fiber-studio-start-node-on-launch", "maybe")
    expect(getStartNodeOnLaunch()).toBe(false)
  })
})
