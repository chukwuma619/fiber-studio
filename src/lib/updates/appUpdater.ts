import { getVersion } from "@tauri-apps/api/app"
import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater"
import { relaunch } from "@tauri-apps/plugin-process"
import { stopNode } from "../fnn/invoke"

export function isDesktopApp(): boolean {
  return import.meta.env.TAURI_ENV_PLATFORM != null
}

export type AppUpdateInfo = {
  version: string
  currentVersion: string
  notes: string | null
  update: Update
}

export async function getAppVersion(): Promise<string> {
  if (!isDesktopApp()) {
    return "web"
  }
  return getVersion()
}

export async function checkForAppUpdate(): Promise<AppUpdateInfo | null> {
  if (!isDesktopApp()) {
    return null
  }

  const update = await check()
  if (!update) {
    return null
  }

  return {
    version: update.version,
    currentVersion: update.currentVersion,
    notes: update.body ?? null,
    update,
  }
}

export async function installAppUpdate(
  update: Update,
  onEvent?: (event: DownloadEvent) => void,
): Promise<void> {
  try {
    await stopNode()
  } catch {
    // Node may already be stopped; continue with the update.
  }

  await update.downloadAndInstall(onEvent)
  await relaunch()
}
