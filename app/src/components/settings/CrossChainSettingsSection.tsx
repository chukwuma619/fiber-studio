import { useEffect, useState } from "react"
import type { NodeSettingsResponse } from "../../lib/fnn/types"
import { Button } from "../ui/button"
import { Description, Field, FieldGroup, Label } from "../ui/fieldset"
import { Input } from "../ui/input"
import { Text } from "../ui/text"
import { SettingsSection } from "./SettingsSection"

type CrossChainSettingsSectionProps = {
  settings: NodeSettingsResponse
  isActing: boolean
  onSave: (cchRpcUrl: string) => Promise<unknown>
}

export function CrossChainSettingsSection({
  settings,
  isActing,
  onSave,
}: CrossChainSettingsSectionProps) {
  const [url, setUrl] = useState(settings.cchRpcUrl ?? "")
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    setUrl(settings.cchRpcUrl ?? "")
  }, [settings.cchRpcUrl])

  const handleSave = async () => {
    setLocalError(null)
    const trimmed = url.trim()
    if (
      trimmed &&
      !trimmed.toLowerCase().startsWith("http://") &&
      !trimmed.toLowerCase().startsWith("https://")
    ) {
      setLocalError("URL must start with http:// or https://.")
      return
    }

    try {
      await onSave(trimmed)
    } catch {
      // Parent hook surfaces actionError.
    }
  }

  return (
    <SettingsSection
      title="Cross-chain"
      subtitle="Pay Lightning invoices with cWBTC (and receive BTC) via a Fiber Cross-Chain Hub."
    >
      <div className="space-y-4 px-5 py-4">
        <FieldGroup>
          <Field>
            <Label>CCH hub RPC URL</Label>
            <Input
              type="url"
              placeholder="https://cch.example:8227"
              className="font-mono text-xs"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              disabled={isActing}
            />
            <Description>
              HTTP(S) JSON-RPC endpoint of a hub that exposes send_btc /
              receive_btc / get_cch_order. Leave empty to disable cross-chain
              payments.
            </Description>
          </Field>
        </FieldGroup>

        {localError ? (
          <Text className="text-xs text-red-600 dark:text-red-400">{localError}</Text>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <Text className="text-xs text-zinc-500 dark:text-zinc-400">
            {settings.cchRpcUrl
              ? "Hub configured — available on the Payments page."
              : "Not configured."}
          </Text>
          <Button
            outline
            className="text-xs"
            disabled={isActing || url.trim() === (settings.cchRpcUrl ?? "").trim()}
            onClick={() => void handleSave()}
          >
            Save
          </Button>
        </div>
      </div>
    </SettingsSection>
  )
}
