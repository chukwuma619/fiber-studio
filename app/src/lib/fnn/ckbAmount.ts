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

/** Convert a CKB amount to shannons, rounded to 8 decimal places. */
export function ckbToShannons(ckb: number): bigint {
  if (!Number.isFinite(ckb)) {
    throw new RangeError("CKB amount must be a finite number.")
  }
  const negative = ckb < 0
  const [wholePart, fracPart = ""] = Math.abs(ckb).toFixed(8).split(".")
  const raw =
    BigInt(wholePart) * SHANNONS_PER_CKB +
    BigInt(fracPart.padEnd(8, "0").slice(0, 8))
  return negative ? -raw : raw
}
