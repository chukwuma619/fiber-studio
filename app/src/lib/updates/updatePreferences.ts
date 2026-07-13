const SKIPPED_VERSION_KEY = "fiber-studio:skipped-update-version"
const SESSION_DISMISSED_KEY = "fiber-studio:update-session-dismissed"

export function getSkippedVersion(): string | null {
  try {
    return localStorage.getItem(SKIPPED_VERSION_KEY)
  } catch {
    return null
  }
}

export function skipVersion(version: string): void {
  try {
    localStorage.setItem(SKIPPED_VERSION_KEY, version)
  } catch {
    // Ignore storage failures in restricted environments.
  }
}

export function isVersionSkipped(version: string): boolean {
  return getSkippedVersion() === version
}

export function isSessionDismissed(): boolean {
  try {
    return sessionStorage.getItem(SESSION_DISMISSED_KEY) === "1"
  } catch {
    return false
  }
}

export function dismissForSession(): void {
  try {
    sessionStorage.setItem(SESSION_DISMISSED_KEY, "1")
  } catch {
    // Ignore storage failures in restricted environments.
  }
}
