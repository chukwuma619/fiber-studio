export type ParsedMaxFeeCkb =
  | { status: "unset" }
  | { status: "ok"; maxFeeCkb: number }
  | { status: "error"; message: string }

/**
 * Parse the Max fee field.
 * - empty → node default (omit max_fee_amount)
 * - literal 0 / 0.00 → error (never silently treat as unset)
 * - positive → explicit maximum
 */
export function parseMaxFeeCkbInput(input: string): ParsedMaxFeeCkb {
  const trimmed = input.trim()
  if (!trimmed) {
    return { status: "unset" }
  }

  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return {
      status: "error",
      message:
        "Enter a valid max fee greater than zero, or leave empty for the node default.",
    }
  }

  const [wholePart, fracPart = ""] = trimmed.split(".")
  const significantFrac = fracPart.replace(/0+$/, "")
  if (significantFrac.length > 8) {
    return {
      status: "error",
      message: "Max fee supports at most 8 decimal places.",
    }
  }

  if (/^0*$/.test(wholePart) && /^0*$/.test(fracPart)) {
    return {
      status: "error",
      message:
        "A max fee of 0 is not supported. Leave empty to use the node default, or enter a positive maximum.",
    }
  }

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return {
      status: "error",
      message:
        "Enter a valid max fee greater than zero, or leave empty for the node default.",
    }
  }

  return { status: "ok", maxFeeCkb: parsed }
}

export function formatEffectiveMaxFeeLabel(input: string): string {
  const parsed = parseMaxFeeCkbInput(input)
  switch (parsed.status) {
    case "unset":
      return "Node default"
    case "ok":
      return `${input.trim()} CKB`
    case "error":
      return "—"
    default: {
      const exhaustive: never = parsed
      return exhaustive
    }
  }
}

export type SendPaymentOptions = {
  maxFeeCkb?: number
  timeoutSeconds?: number
}

export type BuildSendOptionsResult =
  | { ok: true; options: SendPaymentOptions }
  | { ok: false; error: string }

export function buildSendOptions(
  maxFeeCkb: string,
  timeoutSeconds: string,
): BuildSendOptionsResult {
  const maxFee = parseMaxFeeCkbInput(maxFeeCkb)
  if (maxFee.status === "error") {
    return { ok: false, error: maxFee.message }
  }

  const trimmedTimeout = timeoutSeconds.trim()
  const parsedTimeout = Number(trimmedTimeout)
  const timeoutSecondsValue =
    trimmedTimeout && Number.isInteger(parsedTimeout) && parsedTimeout > 0
      ? parsedTimeout
      : undefined

  return {
    ok: true,
    options: {
      maxFeeCkb: maxFee.status === "ok" ? maxFee.maxFeeCkb : undefined,
      timeoutSeconds: timeoutSecondsValue,
    },
  }
}
