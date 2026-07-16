import { sanitizeRpcError } from "./format"

const MIGRATION_REQUIRED_PREFIX = "MIGRATION_REQUIRED:"

export type MigrationRequiredDetails = {
  message: string
  hasBreakingChange: boolean
}

/** Extract a user-facing message from a thrown Tauri / FNN error. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return sanitizeRpcError(error.message)
  }
  if (typeof error === "string") {
    return sanitizeRpcError(error)
  }
  return sanitizeRpcError(String(error))
}

export function parseMigrationRequiredError(
  error: unknown,
): MigrationRequiredDetails | null {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : String(error)

  if (!raw.startsWith(MIGRATION_REQUIRED_PREFIX)) {
    return null
  }

  const payload = raw.slice(MIGRATION_REQUIRED_PREFIX.length)
  const [message, ...flags] = payload.split("|")
  const hasBreakingChange = flags.some((flag) => flag === "breaking_change=true")

  return {
    message: message.trim(),
    hasBreakingChange,
  }
}
