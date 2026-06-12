import {
  getDataDirectoryPlatformHint,
  getDefaultDataDirectoryDisplay,
  joinDataPath,
} from "../../../lib/data-directory"
import { Description, Field, Label } from "../../ui/fieldset"
import { Heading } from "../../ui/heading"
import { Input } from "../../ui/input"
import { Code, Text } from "../../ui/text"

type DataDirectoryStepProps = {
  dataDirectory: string
  onChange: (path: string) => void
}

export function DataDirectoryStep({
  dataDirectory,
  onChange,
}: DataDirectoryStepProps) {
  const defaultPath = getDefaultDataDirectoryDisplay()
  const displayPath = dataDirectory || defaultPath

  return (
    <div className="space-y-4">
      <div>
        <Heading level={2}>Data directory</Heading>
        <Text className="mt-1">
          fnn stores its configuration, database, and CKB key under this folder.
        </Text>
      </div>

      <Field>
        <Label>Directory path</Label>
        <Input
          value={dataDirectory}
          onChange={(event) => onChange(event.target.value)}
          placeholder={defaultPath}
          className="font-mono text-xs"
        />
        <Description>{getDataDirectoryPlatformHint()}</Description>
      </Field>

      <div className="rounded-lg bg-zinc-950/2.5 px-4 py-3 ring-1 ring-zinc-950/5 dark:bg-white/5 dark:ring-white/10">
        <Text className="text-xs">
          Expected layout:{" "}
          <Code className="font-mono">
            {joinDataPath(displayPath, "config.yml")}
          </Code>
          ,{" "}
          <Code className="font-mono">
            {joinDataPath(displayPath, "ckb", "key")}
          </Code>
        </Text>
      </div>
    </div>
  )
}
