import { useState } from "react"
import type {
  NodeSettingsResponse,
  UpdateWalletPasswordPayload,
} from "../../lib/fnn/types"
import { truncatePubkey } from "../../lib/public-relays"
import { Button } from "../ui/button"
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
