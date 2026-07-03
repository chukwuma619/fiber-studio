export type ParsedSetupError = {
  title: string
  hint?: string
  details: string
}

export function parseSetupStartError(message: string): ParsedSetupError {
  const lower = message.toLowerCase()

  if (
    lower.includes("invalid") &&
    (lower.includes("key") || lower.includes("private"))
  ) {
    return {
      title: "Your wallet key could not be used to start the node.",
      hint: "Go back to the Wallet key step, paste your key again, and make sure it is 64 hex characters. A 0x prefix is fine — Fiber Studio strips it automatically.",
      details: message,
    }
  }

  if (message.includes("fnn did not become ready")) {
    return {
      title: "The node did not start successfully.",
      hint: "Check your network, peer, and wallet key, then try again. If the problem continues, expand the technical details below.",
      details: message,
    }
  }

  if (message.startsWith("Failed to prepare data directory:")) {
    return {
      title: "Fiber Studio could not prepare your data folder.",
      hint: "Check that the app can write to your data directory, then try again.",
      details: message,
    }
  }

  if (message.startsWith("Failed to store password in keychain:")) {
    return {
      title: "Your password could not be saved to the OS keychain.",
      hint: "Try again, or check macOS Keychain / Windows Credential Manager permissions for Fiber Studio.",
      details: message,
    }
  }

  return {
    title: "Setup could not be completed.",
    details: message,
  }
}
