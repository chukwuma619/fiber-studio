import { normalizeCkbPrivateKey } from "../../../lib/ckb-key"
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
  function handleBlur() {
    if (!importedPrivateKey.trim()) return
    onPrivateKeyChange(normalizeCkbPrivateKey(importedPrivateKey))
  }

  return (
    <div className="space-y-5">
      <div>
        <Heading level={2} tabIndex={-1}>Wallet key</Heading>
        <Text className="mt-1">
          Paste your CKB private key. It stays on this computer.
        </Text>
      </div>

      <Field>
        <Label>CKB private key (hex)</Label>
        <Input
          type="password"
          value={importedPrivateKey}
          onChange={(event) => onPrivateKeyChange(event.target.value)}
          onBlur={handleBlur}
          placeholder="64 hex characters (0x prefix is OK)"
          autoComplete="off"
          spellCheck={false}
          className="font-mono text-xs"
          data-invalid={error ? true : undefined}
        />
        {error ? <ErrorMessage>{error}</ErrorMessage> : null}
      </Field>

      <div className="rounded-lg bg-zinc-50 px-4 py-3 ring-1 ring-zinc-950/10 dark:bg-white/5 dark:ring-white/10">
        <p className="text-xs font-medium text-zinc-950 dark:text-white">
          Don&apos;t have a key yet?
        </p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Export a private key from{" "}
          <a
            href="https://neuron.magickbase.com/"
            target="_blank"
            rel="noreferrer"
            className="text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-950 dark:text-zinc-300 dark:decoration-zinc-600 dark:hover:text-white"
          >
            Neuron
          </a>
          . Developers can generate one with{" "}
          <code className="rounded bg-zinc-950/5 px-1 py-0.5 font-mono text-[0.7rem] text-zinc-700 dark:bg-white/10 dark:text-zinc-300">
            ckb-cli account new
          </code>
          .
        </p>
      </div>
    </div>
  )
}
