import { validateCkbPrivateKey } from "../../../lib/ckb-key"
import {
  getDefaultDataDirectoryDisplay,
  joinDataPath,
} from "../../../lib/data-directory"
import type { KeyFileMode } from "../../../lib/setup/types"
import { Description, ErrorMessage, Field, Label } from "../../ui/fieldset"
import { Heading } from "../../ui/heading"
import { Input } from "../../ui/input"
import { Text } from "../../ui/text"
import { SelectionCard } from "../SelectionCard"

type KeyFileStepProps = {
  keyFileMode: KeyFileMode
  keyFilePath: string
  importedPrivateKey: string
  dataDirectory: string
  onModeChange: (mode: KeyFileMode) => void
  onPathChange: (path: string) => void
  onPrivateKeyChange: (key: string) => void
}

const MODES: { value: KeyFileMode; label: string; description: string }[] = [
  {
    value: "import",
    label: "Paste my private key",
    description:
      "You exported a 64-character hex key from a CKB wallet — most people start here.",
  },
  {
    value: "existing",
    label: "Fiber is already set up here",
    description:
      "You ran Fiber before and your key is already in the data folder.",
  },
]

const IMPORT_STEPS = [
  "Export your CKB private key from Neuron, JoyID, or ckb-cli.",
  "Paste the 64-character hex key below. If your export has two lines, paste only the first line.",
  "Fiber Studio saves it to your data folder. On the next step, choose a password to protect it on this computer.",
] as const

export function KeyFileStep({
  keyFileMode,
  keyFilePath,
  importedPrivateKey,
  dataDirectory,
  onModeChange,
  onPathChange,
  onPrivateKeyChange,
}: KeyFileStepProps) {
  const destinationPath = joinDataPath(
    dataDirectory || getDefaultDataDirectoryDisplay(),
    "ckb",
    "key",
  )
  const keyError = validateCkbPrivateKey(importedPrivateKey)

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

      <div className="grid gap-3 sm:grid-cols-2">
        {MODES.map((mode) => (
          <SelectionCard
            key={mode.value}
            selected={keyFileMode === mode.value}
            onClick={() => onModeChange(mode.value)}
            title={mode.label}
            description={mode.description}
          />
        ))}
      </div>

      {keyFileMode === "import" ? (
        <>
          <ol className="space-y-3 rounded-lg bg-zinc-950/2.5 px-4 py-4 ring-1 ring-zinc-950/5 dark:bg-white/5 dark:ring-white/10">
            {IMPORT_STEPS.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm">
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white dark:bg-white dark:text-zinc-900"
                  aria-hidden
                >
                  {index + 1}
                </span>
                <span className="leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {step}
                </span>
              </li>
            ))}
          </ol>

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
              data-invalid={keyError ? true : undefined}
            />
            <Description>
              Saved to {destinationPath} when you start the node.
            </Description>
            {keyError ? <ErrorMessage>{keyError}</ErrorMessage> : null}
          </Field>

          {importedPrivateKey && !keyError ? (
            <div className="rounded-lg bg-blue-500/10 px-3 py-2.5 ring-1 ring-blue-500/20 dark:bg-blue-500/10 dark:ring-blue-500/20">
              <p className="text-xs text-blue-800 dark:text-blue-300">
                Key looks valid. It will be written to{" "}
                <span className="font-mono">{destinationPath}</span> when you
                finish setup.
              </p>
            </div>
          ) : null}

          <div className="rounded-lg bg-white px-4 py-3 ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
            <p className="text-xs font-medium text-zinc-950 dark:text-white">
              Don&apos;t have a key yet?
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              Create or open a CKB wallet in Neuron or JoyID, export your
              private key, then paste the hex string here.
            </p>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <Text>
            We&apos;ll use the key already in your Fiber data folder. You only
            need this option if you previously installed Fiber on this computer.
          </Text>
          <Field>
            <Label>Key location</Label>
            <Input
              value={keyFilePath}
              onChange={(event) => onPathChange(event.target.value)}
              placeholder="ckb/key"
              className="font-mono text-xs"
            />
            <Description>
              Relative to your data folder, or an absolute path. Default:{" "}
              {destinationPath}
            </Description>
          </Field>
        </div>
      )}
    </div>
  )
}
