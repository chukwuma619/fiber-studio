import { useState } from "react"
import type {
  NodeSettingsResponse,
  UpdateWalletPasswordPayload,
} from "../../lib/fnn/types"
import { Button } from "../ui/button"
import { CopyButton } from "../ui/copy-button"
import { ChangePasswordDialog } from "./ChangePasswordDialog"
import { SettingsRow, SettingsRows, SettingsSection } from "./SettingsSection"

type WalletSettingsSectionProps = {
  settings: NodeSettingsResponse
  nodeStopped: boolean
  isActing: boolean
  onUpdatePassword: (payload: UpdateWalletPasswordPayload) => Promise<unknown>
}

export function WalletSettingsSection({
  settings,
  nodeStopped,
  isActing,
  onUpdatePassword,
}: WalletSettingsSectionProps) {
  const [passwordOpen, setPasswordOpen] = useState(false)

  return (
    <>
      <SettingsSection
        title="CKB wallet"
        actions={
          <Button
            outline
            className="text-xs"
            disabled={!nodeStopped || isActing}
            onClick={() => setPasswordOpen(true)}
          >
            Change password
          </Button>
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
            mono
            value={
              settings.ckbWalletAddress ? (
                <span className="inline-flex items-center justify-end gap-2">
                  <span>{settings.ckbWalletAddress}</span>
                  <CopyButton
                    value={settings.ckbWalletAddress}
                    label="Copy on-chain address"
                  />
                </span>
              ) : (
                "Start node to load"
              )
            }
          />
          {settings.nodePubKey ? (
            <SettingsRow
              label="Node pubkey"
              mono
              value={
                <span className="inline-flex items-center justify-end gap-2">
                  <span>{settings.nodePubKey}</span>
                  <CopyButton
                    value={settings.nodePubKey}
                    label="Copy node pubkey"
                  />
                </span>
              }
            />
          ) : null}
        </SettingsRows>
        {!nodeStopped ? (
          <p className="border-t border-zinc-200 px-5 py-3 text-xs text-amber-700 dark:border-zinc-800 dark:text-amber-400">
            Stop your node before changing the wallet password.
          </p>
        ) : null}
      </SettingsSection>

      <ChangePasswordDialog
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        isActing={isActing}
        onSave={onUpdatePassword}
      />
    </>
  )
}
