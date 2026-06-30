import { isTauri } from "@tauri-apps/api/core"
import { dataDir, homeDir, join, sep } from "@tauri-apps/api/path"
import { platform } from "@tauri-apps/plugin-os"
import type { NetworkChoice } from "./setup/types"

export type DesktopPlatform = "macos" | "windows" | "linux"

const LEGACY_DIR_NAME = "fiber-studio"

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

export function getDataDirectoryDirName(network: NetworkChoice): string {
  return `fiber-studio-${network}`
}

/** User-facing tilde path for a network. */
export function getDataDirectoryDisplayForNetwork(
  network: NetworkChoice,
): string {
  const dirName = getDataDirectoryDirName(network)
  const currentPlatform = detectPlatform()
  switch (currentPlatform) {
    case "macos":
      return `~/Library/${dirName}`
    case "windows":
      return `~\\AppData\\Roaming\\${dirName}`
    case "linux":
      return `~/.local/share/${dirName}`
    default: {
      const _exhaustive: never = currentPlatform
      return _exhaustive
    }
  }
}

/** User-facing tilde path for the legacy single-network folder. */
export function getLegacyDataDirectoryDisplay(): string {
  const currentPlatform = detectPlatform()
  switch (currentPlatform) {
    case "macos":
      return `~/Library/${LEGACY_DIR_NAME}`
    case "windows":
      return `~\\AppData\\Roaming\\${LEGACY_DIR_NAME}`
    case "linux":
      return `~/.local/share/${LEGACY_DIR_NAME}`
    default: {
      const _exhaustive: never = currentPlatform
      return _exhaustive
    }
  }
}

export function isLegacyDataDirectoryPath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/").replace(/\/$/, "")
  return (
    normalized.endsWith(`/${LEGACY_DIR_NAME}`) &&
    !normalized.endsWith("/fiber-studio-mainnet") &&
    !normalized.endsWith("/fiber-studio-testnet")
  )
}

/**
 * Resolve the fnn data directory for a network using Tauri path APIs.
 * @see https://v2.tauri.app/reference/javascript/api/namespacepath/
 */
export async function resolveDataDirectoryForNetwork(
  network: NetworkChoice,
): Promise<string> {
  if (!isTauriRuntime()) {
    return getDataDirectoryDisplayForNetwork(network)
  }

  const dirName = getDataDirectoryDirName(network)
  const currentPlatform = detectPlatform()
  switch (currentPlatform) {
    case "macos":
      return join(await homeDir(), "Library", dirName)
    case "windows":
    case "linux":
      return join(await dataDir(), dirName)
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

export async function resolveConfiguredDataDirectory(
  network: NetworkChoice | undefined,
): Promise<string | undefined> {
  if (!network) return undefined
  return resolveDataDirectoryForNetwork(network)
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
