import {
  getDataDirectoryPlatformHint,
  getDefaultDataDirectoryDisplay,
} from "../../../lib/data-directory"
import { Description, Field, Label } from "../../ui/fieldset"
import { Heading } from "../../ui/heading"
import { Input } from "../../ui/input"
import { Text } from "../../ui/text"

type DataDirectoryStepProps = {
  dataDirectory: string
  onChange: (path: string) => void
}

export function DataDirectoryStep({
  dataDirectory,
  onChange,
}: DataDirectoryStepProps) {
  const defaultPath = getDefaultDataDirectoryDisplay()

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
    </div>
  )
}
