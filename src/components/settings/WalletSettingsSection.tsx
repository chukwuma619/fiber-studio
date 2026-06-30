import { useState } from "react"
import type {
  MigrateDataDirectoryPayload,
  NodeSettingsResponse,
  UpdateWalletPasswordPayload,
} from "../../lib/fnn/types"
import { truncatePubkey } from "../../lib/public-relays"
import { Button } from "../ui/button"
import { ChangeDataDirectoryDialog } from "./ChangeDataDirectoryDialog"
import { ChangePasswordDialog } from "./ChangePasswordDialog"
import { SettingsRow, SettingsRows, SettingsSection } from "./SettingsSection"

type WalletSettingsSectionProps = {
  settings: NodeSettingsResponse
  nodeStopped: boolean
  isActing: boolean
  onUpdatePassword: (payload: UpdateWalletPasswordPayload) => Promise<unknown>
  onMigrateDataDirectory: (payload: MigrateDataDirectoryPayload) => Promise<unknown>
}

export function WalletSettingsSection({
  settings,
  nodeStopped,
  isActing,
  onUpdatePassword,
  onMigrateDataDirectory,
}: WalletSettingsSectionProps) {
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [dataDirOpen, setDataDirOpen] = useState(false)

  return (
    <>
      <SettingsSection
        title="CKB wallet"
        actions={
          <>
            <Button
              outline
              className="text-xs"
              disabled={!nodeStopped || isActing}
              onClick={() => setPasswordOpen(true)}
            >
              Change password
            </Button>
            <Button
              outline
              className="text-xs"
              disabled={!nodeStopped || isActing}
              onClick={() => setDataDirOpen(true)}
            >
              Move data dir
            </Button>
          </>
        }
      >
        <SettingsRows>
          <SettingsRow label="Key file" value="ckb/key" mono />
          <SettingsRow
            label="Key password"
            value={
              settings.walletPasswordStored
                ? "Stored in OS keychain"
                : "Not configured"
            }
          />
          <SettingsRow
            label="On-chain address"
            value={settings.ckbWalletAddress ?? "Start node to load"}
            mono
          />
          {settings.nodePubKey ? (
            <SettingsRow
              label="Node pubkey"
              value={truncatePubkey(settings.nodePubKey)}
              mono
            />
          ) : null}
        </SettingsRows>
        {!nodeStopped ? (
          <p className="border-t border-zinc-200 px-5 py-3 text-xs text-amber-700 dark:border-zinc-800 dark:text-amber-400">
            Stop your node before changing the wallet password or data directory.
          </p>
        ) : null}
      </SettingsSection>

      <ChangePasswordDialog
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        isActing={isActing}
        onSave={onUpdatePassword}
      />

      <ChangeDataDirectoryDialog
        open={dataDirOpen}
        onClose={() => setDataDirOpen(false)}
        currentDataDirectory={settings.dataDirectory ?? ""}
        isActing={isActing}
        onSave={onMigrateDataDirectory}
      />
    </>
  )
}
