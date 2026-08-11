const SHANNONS_PER_CKB = 100_000_000n

export function parseHexU128(hex: string): bigint {
  const trimmed = hex.startsWith("0x") ? hex.slice(2) : hex
  if (!trimmed) return 0n
  return BigInt(`0x${trimmed}`)
}

/** Format shannons as a CKB decimal, preserving up to 8 places (never rounds a non-zero fee to 0.00). */
export function formatCkb(shannons: bigint | string): string {
  const value = typeof shannons === "string" ? parseHexU128(shannons) : shannons
  const whole = value / SHANNONS_PER_CKB
  const fraction = value % SHANNONS_PER_CKB
  const fractionStr = fraction.toString().padStart(8, "0").replace(/0+$/, "")
  if (!fractionStr) {
    return whole.toString()
  }
  return `${whole}.${fractionStr}`
}

export function ckbToShannons(ckb: number): bigint {
  return BigInt(ckb) * SHANNONS_PER_CKB
}
