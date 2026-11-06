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
    case "key-file": {
      if (!config.importedPrivateKey.trim()) {
        return "Private key is required."
      }
      return validateCkbPrivateKey(config.importedPrivateKey)
    }
    case "password": {
      if (!config.password.trim()) {
        return "Password is required."
      }
      if (!config.passwordConfirm.trim()) {
        return "Confirm your password."
      }
      if (config.password !== config.passwordConfirm) {
        return "Passwords do not match."
      }
      return null
    }
    default: {
      const _exhaustive: never = step
      return _exhaustive
    }
  }
}
