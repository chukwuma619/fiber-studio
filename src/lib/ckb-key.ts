/** Normalize pasted CKB secp256k1 private key (first line, optional 0x prefix). */
export function normalizeCkbPrivateKey(input: string): string {
  const firstLine =
    input.trim().split(/\r?\n/).find((line) => line.trim()) ?? ""
  const trimmed = firstLine.trim()
  const hex =
    trimmed.startsWith("0x") || trimmed.startsWith("0X")
      ? trimmed.slice(2)
      : trimmed
  return hex.toLowerCase()
}

/** Returns a user-facing error, or null when empty or valid. */
export function validateCkbPrivateKey(input: string): string | null {
  if (!input.trim()) return null
  const hex = normalizeCkbPrivateKey(input)
  if (hex.length !== 64) {
    return "Private key must be exactly 64 hex characters."
  }
  if (!/^[0-9a-f]+$/.test(hex)) {
    return "Use only hex characters (0–9, a–f)."
  }
  return null
}
