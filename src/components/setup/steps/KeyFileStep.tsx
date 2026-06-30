import { validateCkbPrivateKey } from "../../../lib/ckb-key"
import { ErrorMessage, Field, Label } from "../../ui/fieldset"
import { Heading } from "../../ui/heading"
import { Input } from "../../ui/input"
import { Text } from "../../ui/text"

type KeyFileStepProps = {
  importedPrivateKey: string
  onPrivateKeyChange: (key: string) => void
  error?: string | null
}

export function KeyFileStep({
  importedPrivateKey,
  onPrivateKeyChange,
  error,
}: KeyFileStepProps) {
  const keyError = validateCkbPrivateKey(importedPrivateKey)
  const displayError = keyError ?? error

  return (
    <div className="space-y-5">
      <div>
        <Heading level={2}>Add your wallet key</Heading>
        <Text className="mt-1 leading-relaxed">
          Fiber needs your CKB wallet key to open payment channels and move CKB
          on-chain. Your key stays on this computer — it is never uploaded
          anywhere.
        </Text>
      </div>


      <Field>
        <Label>CKB private key (hex)</Label>
        <Input
          type="password"
          value={importedPrivateKey}
          onChange={(event) => onPrivateKeyChange(event.target.value)}
          placeholder="64 hex characters (optional 0x prefix)"
          autoComplete="off"
          spellCheck={false}
          className="font-mono text-xs"
          data-invalid={displayError ? true : undefined}
        />
        {displayError ? <ErrorMessage>{displayError}</ErrorMessage> : null}
      </Field>



      <div className="rounded-lg bg-zinc-950/2.5 px-4 py-3 ring-1 ring-zinc-950/5 dark:bg-white/5 dark:ring-white/10">
        <p className="text-xs font-medium text-zinc-950 dark:text-white">
          Don&apos;t have a key yet?
        </p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Create or open a CKB wallet in Neuron or JoyID, export your private
          key, then paste the hex string here.
        </p>
      </div>
    </div>
  )
}
