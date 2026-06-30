import { useState } from "react"
import { getDataDirectoryDisplayForNetwork } from "../../lib/data-directory"
import { canSwitchNetwork } from "../../lib/setup/network"
import type { NetworkChoice } from "../../lib/setup/types"
import { formatNetworkLabel } from "../../lib/fnn/useNodeControl"
import type { NodeSettingsResponse, SwitchNetworkPayload } from "../../lib/fnn/types"
import { Button } from "../ui/button"
import { ChangeNetworkDialog } from "./ChangeNetworkDialog"
import { SettingsRow, SettingsRows, SettingsSection } from "./SettingsSection"

type NodeSettingsSectionProps = {
  settings: NodeSettingsResponse
  nodeStopped: boolean
  isActing: boolean
  onSwitchNetwork: (payload: SwitchNetworkPayload) => Promise<unknown>
}

export function NodeSettingsSection({
  settings,
  nodeStopped,
  isActing,
  onSwitchNetwork,
}: NodeSettingsSectionProps) {
  const [networkOpen, setNetworkOpen] = useState(false)
  const currentNetwork = (settings.network as NetworkChoice) ?? "testnet"
  const showSwitchNetwork = canSwitchNetwork(currentNetwork)

  return (
    <>
      <SettingsSection
        title="Node"
        actions={
          showSwitchNetwork ? (
            <Button
              outline
              className="text-xs"
              disabled={!nodeStopped || isActing}
              onClick={() => setNetworkOpen(true)}
            >
              Switch network
            </Button>
          ) : undefined
        }
      >
        <SettingsRows>
          <SettingsRow
            label="Network"
            value={settings.network ? formatNetworkLabel(settings.network) : "—"}
          />
          <SettingsRow label="Config file" value="config.yml" mono />
          <SettingsRow
            label="Data directory"
            value={getDataDirectoryDisplayForNetwork(currentNetwork)}
            mono
          />
          <SettingsRow
            label="RPC listen"
            value={settings.rpcListenAddr ?? "127.0.0.1:8227"}
            mono
          />
          <SettingsRow label="fnn version" value={settings.fnnVersion} />
        </SettingsRows>
        {!nodeStopped ? (
          <p className="border-t border-zinc-200 px-5 py-3 text-xs text-amber-700 dark:border-zinc-800 dark:text-amber-400">
            Stop your node before switching networks. Manage peers and relays on
            the Network page.
          </p>
        ) : null}
      </SettingsSection>

      {showSwitchNetwork ? (
        <ChangeNetworkDialog
          open={networkOpen}
          onClose={() => setNetworkOpen(false)}
          currentNetwork={currentNetwork}
          isActing={isActing}
          onSave={async (payload) => {
            await onSwitchNetwork(payload)
            setNetworkOpen(false)
          }}
        />
      ) : null}
    </>
  )
}
