import { validateCkbPrivateKey } from "../ckb-key"
import type { SetupConfig, SetupStep } from "./types"

export function validateSetupStep(
  step: SetupStep,
  config: SetupConfig,
): string | null {
  switch (step) {
    case "welcome":
    case "network":
    case "review":
      return null
    case "public-network": {
      const pubkey = config.customPublicNodePubkey.trim()
      if (!pubkey) {
        return "Peer pubkey is required."
      }
      const normalized = pubkey.startsWith("0x") ? pubkey.slice(2) : pubkey
      if (!/^[0-9a-fA-F]+$/.test(normalized)) {
        return "Pubkey must be a hex string."
      }
      if (normalized.length < 64 || normalized.length > 66) {
        return "Pubkey must be 64–66 hex characters."
      }
      return null
    }
    case "key-file": {
      if (!config.importedPrivateKey.trim()) {
        return "Private key is required."
      }
      return validateCkbPrivateKey(config.importedPrivateKey)
    }
    case "password":
      if (!config.password.trim()) {
        return "Password is required."
      }
      return null
    default: {
      const _exhaustive: never = step
      return _exhaustive
    }
  }
}
