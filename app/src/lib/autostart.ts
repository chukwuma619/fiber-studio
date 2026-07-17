import { isTauri } from "@tauri-apps/api/core"
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart"
import {
  getLaunchAtLogin,
  getStartNodeOnLaunch,
  setLaunchAtLogin,
  setStartNodeOnLaunch,
} from "./appPreferences"

export async function syncLaunchAtLoginPreference(): Promise<boolean> {
  if (!isTauri()) {
    return getLaunchAtLogin()
  }

  const preferred = getLaunchAtLogin()
  const active = await isEnabled()

  if (preferred && !active) {
    await enable()
    return true
  }

  if (!preferred && active) {
    await disable()
    return false
  }

  return active
}

export async function applyLaunchAtLoginPreference(enabled: boolean): Promise<void> {
  setLaunchAtLogin(enabled)

  if (!isTauri()) {
    return
  }

  if (enabled) {
    await enable()
    return
  }

  await disable()
}

export function readStartNodeOnLaunchPreference(): boolean {
  return getStartNodeOnLaunch()
}

export function applyStartNodeOnLaunchPreference(enabled: boolean): void {
  setStartNodeOnLaunch(enabled)
}
