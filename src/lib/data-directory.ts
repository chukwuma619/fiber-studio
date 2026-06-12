import { isTauri } from "@tauri-apps/api/core"
import { dataDir, homeDir, join, sep } from "@tauri-apps/api/path"
import { platform } from "@tauri-apps/plugin-os"

export type DesktopPlatform = "macos" | "windows" | "linux"

const APP_DIR_NAME = "fiber-studio"

/** True when running inside the Tauri webview (`tauri dev` / packaged app). */
export function isTauriRuntime(): boolean {
  return isTauri()
}

function mapTauriEnvPlatform(
  tauriPlatform: string,
): DesktopPlatform | null {
  switch (tauriPlatform) {
    case "darwin":
      return "macos"
    case "windows":
      return "windows"
    case "linux":
      return "linux"
    default:
      return null
  }
}

function mapOsPlatform(osPlatform: string): DesktopPlatform {
  switch (osPlatform) {
    case "macos":
      return "macos"
    case "windows":
      return "windows"
    case "linux":
    case "freebsd":
    case "dragonfly":
    case "netbsd":
    case "openbsd":
    case "solaris":
      return "linux"
    case "ios":
    case "android":
      return "linux"
    default:
      return "linux"
  }
}

/**
 * Runtime OS via the OS plugin in Tauri; compile-time env for Vite-only dev.
 * @see https://v2.tauri.app/plugin/os-info/
 */
export function detectPlatform(): DesktopPlatform {
  if (isTauri()) {
    return mapOsPlatform(platform())
  }

  const fromEnv = import.meta.env.TAURI_ENV_PLATFORM
    ? mapTauriEnvPlatform(import.meta.env.TAURI_ENV_PLATFORM)
    : null
  if (fromEnv) return fromEnv

  // Vite-only dev (`bun run dev`) — use `bun run tauri dev` for accurate platform paths.
  return "linux"
}

/** User-facing tilde path for placeholders and browser-only dev. */
export function getDefaultDataDirectoryDisplay(): string {
  const currentPlatform = detectPlatform()
  switch (currentPlatform) {
    case "macos":
      return `~/Library/${APP_DIR_NAME}`
    case "windows":
      return `~\\AppData\\Roaming\\${APP_DIR_NAME}`
    case "linux":
      return `~/.local/share/${APP_DIR_NAME}`
    default: {
      const _exhaustive: never = currentPlatform
      return _exhaustive
    }
  }
}

/** @deprecated Use getDefaultDataDirectoryDisplay() for sync UI or resolveDefaultDataDirectory() for Tauri. */
export function getDefaultDataDirectory(): string {
  return getDefaultDataDirectoryDisplay()
}

/**
 * Resolve the default fnn data directory using Tauri path APIs.
 * @see https://v2.tauri.app/reference/javascript/api/namespacepath/
 */
export async function resolveDefaultDataDirectory(): Promise<string> {
  if (!isTauriRuntime()) {
    return getDefaultDataDirectoryDisplay()
  }

  const currentPlatform = detectPlatform()
  switch (currentPlatform) {
    case "macos":
      // fnn data lives under ~/Library/fiber-studio (not Application Support).
      return join(await homeDir(), "Library", APP_DIR_NAME)
    case "windows":
    case "linux":
      // dataDir() → Roaming AppData on Windows, XDG data dir on Linux.
      return join(await dataDir(), APP_DIR_NAME)
    default: {
      const _exhaustive: never = currentPlatform
      return _exhaustive
    }
  }
}

export function getDataDirectoryPlatformHint(): string {
  const currentPlatform = detectPlatform()
  switch (currentPlatform) {
    case "macos":
      return "Default location on macOS. Config, logs, and ckb/key live here."
    case "windows":
      return "Default location on Windows. Config, logs, and ckb/key live here."
    case "linux":
      return "Default location on Linux. Config, logs, and ckb/key live here."
    default: {
      const _exhaustive: never = currentPlatform
      return _exhaustive
    }
  }
}

export function pathSeparator(): string {
  if (isTauriRuntime()) {
    return sep()
  }
  return detectPlatform() === "windows" ? "\\" : "/"
}

/** Sync path join for UI rendering (browser dev + Tauri). */
export function joinDataPath(base: string, ...segments: string[]): string {
  const separator = pathSeparator()
  const normalizedBase = base.replace(/[/\\]+$/, "")
  return [normalizedBase, ...segments].join(separator)
}

/** Platform-correct join via Tauri when available. */
export async function joinDataPathAsync(
  base: string,
  ...segments: string[]
): Promise<string> {
  if (isTauriRuntime()) {
    return join(base, ...segments)
  }
  return joinDataPath(base, ...segments)
}

/** Expand a tilde-prefixed path to an absolute path in Tauri. */
export async function resolveDataDirectory(path: string): Promise<string> {
  if (!path.startsWith("~")) return path
  if (!isTauriRuntime()) return path

  const home = await homeDir()
  const rest = path.slice(1).replace(/^[/\\]/, "")
  const parts = rest.split(/[/\\]/).filter(Boolean)
  return join(home, ...parts)
}
