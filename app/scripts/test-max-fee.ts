/**
 * Lightweight regression checks for Max fee parsing / formatting.
 * Run: node --experimental-strip-types scripts/test-max-fee.ts
 */
import assert from "node:assert/strict"
import { formatCkb } from "../src/lib/fnn/ckbAmount.ts"
import {
  buildSendOptions,
  formatEffectiveMaxFeeLabel,
  parseMaxFeeCkbInput,
} from "../src/lib/fnn/maxFee.ts"

function testEmptyInputUsesNodeDefault() {
  assert.deepEqual(parseMaxFeeCkbInput(""), { status: "unset" })
  assert.deepEqual(parseMaxFeeCkbInput("   "), { status: "unset" })
  const built = buildSendOptions("", "120")
  assert.equal(built.ok, true)
  if (built.ok) {
    assert.equal(built.options.maxFeeCkb, undefined)
    assert.equal(built.options.timeoutSeconds, 120)
  }
  assert.equal(formatEffectiveMaxFeeLabel(""), "Node default")
}

function testLiteralZeroIsRejected() {
  for (const input of ["0", "0.0", "0.00", "0.00000000"]) {
    const parsed = parseMaxFeeCkbInput(input)
    assert.equal(parsed.status, "error", `expected error for ${input}`)
    if (parsed.status === "error") {
      assert.match(parsed.message, /max fee of 0 is not supported/i)
    }
    const built = buildSendOptions(input, "120")
    assert.equal(built.ok, false)
  }
}

function testExplicitPositiveMaximum() {
  const parsed = parseMaxFeeCkbInput("1.25")
  assert.deepEqual(parsed, { status: "ok", maxFeeCkb: 1.25 })
  const built = buildSendOptions("1.25", "60")
  assert.equal(built.ok, true)
  if (built.ok) {
    assert.equal(built.options.maxFeeCkb, 1.25)
    assert.equal(built.options.timeoutSeconds, 60)
  }
  assert.equal(formatEffectiveMaxFeeLabel("1.25"), "1.25 CKB")
}

function testSubCentNonZeroFeesRemainVisible() {
  // 366504 shannons = 0.00366504 CKB — must not render as 0.00
  assert.equal(formatCkb(366_504n), "0.00366504")
  // 1 shannon
  assert.equal(formatCkb(1n), "0.00000001")
  // hex form used by preview.feeShannons (366504 = 0x597a8)
  assert.equal(formatCkb("0x597a8"), "0.00366504")

  const parsed = parseMaxFeeCkbInput("0.00366504")
  assert.deepEqual(parsed, { status: "ok", maxFeeCkb: 0.00366504 })
  assert.equal(formatEffectiveMaxFeeLabel("0.00366504"), "0.00366504 CKB")
}

function testInvalidAndExcessPrecision() {
  assert.equal(parseMaxFeeCkbInput("abc").status, "error")
  assert.equal(parseMaxFeeCkbInput("-1").status, "error")
  const excess = parseMaxFeeCkbInput("0.011111111")
  assert.equal(excess.status, "error")
  if (excess.status === "error") {
    assert.match(excess.message, /8 decimal places/i)
  }
}

testEmptyInputUsesNodeDefault()
testLiteralZeroIsRejected()
testExplicitPositiveMaximum()
testSubCentNonZeroFeesRemainVisible()
testInvalidAndExcessPrecision()

console.log("test-max-fee: all checks passed")
