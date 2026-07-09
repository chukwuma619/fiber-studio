import { sanitizeRpcError } from "./format"

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
