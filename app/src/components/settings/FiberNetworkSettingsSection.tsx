import { useEffect, useState } from "react"
import type { NodeSettingsResponse } from "../../lib/fnn/types"
import { Button } from "../ui/button"
import { Description, Field, FieldGroup, Label } from "../ui/fieldset"
import { Switch, SwitchField } from "../ui/switch"
import { Text } from "../ui/text"
import { Textarea } from "../ui/textarea"
import { SettingsRow, SettingsRows, SettingsSection } from "./SettingsSection"

type FiberNetworkSettingsSectionProps = {
  settings: NodeSettingsResponse
  nodeStopped: boolean
  isActing: boolean
  onUpdateStoreSyncWrites: (enabled: boolean) => Promise<unknown>
  onUpdateListeningAddrs: (listeningAddrs: string[]) => Promise<unknown>
}

export function FiberNetworkSettingsSection({
  settings,
  nodeStopped,
  isActing,
  onUpdateStoreSyncWrites,
  onUpdateListeningAddrs,
}: FiberNetworkSettingsSectionProps) {
  const [addrsText, setAddrsText] = useState(
    settings.fiberListeningAddrs.join("\n"),
  )
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    setAddrsText(settings.fiberListeningAddrs.join("\n"))
  }, [settings.fiberListeningAddrs])

  const parsedAddrs = addrsText
    .split(/[\n,]+/)
    .map((addr) => addr.trim())
    .filter(Boolean)

  const addrsDirty =
    parsedAddrs.join("\n") !== settings.fiberListeningAddrs.join("\n")

  const handleSaveAddrs = async () => {
    setLocalError(null)
    for (const addr of parsedAddrs) {
      if (!addr.startsWith("/")) {
        setLocalError(
          `Listening address must be a multiaddr starting with / (got "${addr}").`,
        )
        return
      }
    }
    try {
      await onUpdateListeningAddrs(parsedAddrs)
    } catch {
      // Parent surfaces actionError.
    }
  }

  const featureValue =
    settings.featureLabels.length > 0
      ? settings.featureLabels.join(", ")
      : settings.nodeStatus.state === "running"
        ? "None reported"
        : "Start node to load features"

  return (
    <SettingsSection
      title="Fiber network"
      subtitle="P2P listen addresses, durability, and Channel V2 capabilities."
    >
      <SettingsRows>
        <SettingsRow
          label="Fiber listen"
          value={settings.fiberListeningAddr ?? "—"}
          mono
        />
        <SettingsRow
          label="Channel protocol"
          value={
            settings.nodeStatus.state === "running"
              ? settings.supportsChannelV2
                ? "V2 (new opens)"
                : "V1 only"
              : "—"
          }
        />
        <SettingsRow label="Node features" value={featureValue} />
      </SettingsRows>

      <div className="space-y-5 border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <SwitchField>
          <Label>Sync store writes to disk</Label>
          <Description>
            Every store write waits for the disk. Safer if you hold others’
            funds (e.g. a relay), but slower. Requires a node restart.
          </Description>
          <Switch
            checked={settings.storeSyncWrites}
            disabled={!nodeStopped || isActing}
            onChange={(checked) => {
              void onUpdateStoreSyncWrites(checked)
            }}
          />
        </SwitchField>

        <FieldGroup>
          <Field>
            <Label>Extra listen addresses</Label>
            <Textarea
              rows={3}
              className="font-mono text-xs"
              placeholder={'/ip6/::/tcp/8228'}
              value={addrsText}
              disabled={!nodeStopped || isActing}
              onChange={(event) => setAddrsText(event.target.value)}
            />
            <Description>
              Optional multiaddrs appended to the primary Fiber listen address
              (one per line). Useful for IPv6. Stop the node before saving.
            </Description>
          </Field>
        </FieldGroup>

        {localError ? (
          <Text className="text-xs text-red-600 dark:text-red-400">
            {localError}
          </Text>
        ) : null}

        {!nodeStopped ? (
          <Text className="text-xs text-amber-700 dark:text-amber-400">
            Stop your node before changing store sync or listen addresses.
          </Text>
        ) : null}

        <div className="flex justify-end">
          <Button
            outline
            className="text-xs"
            disabled={!nodeStopped || isActing || !addrsDirty}
            onClick={() => void handleSaveAddrs()}
          >
            Save listen addresses
          </Button>
        </div>
      </div>
    </SettingsSection>
  )
}
