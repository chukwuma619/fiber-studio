import { ErrorMessage, Field, Label } from "../../ui/fieldset"
import { Heading } from "../../ui/heading"
import { Input } from "../../ui/input"
import { Text } from "../../ui/text"

type PasswordStepProps = {
  password: string
  onChange: (password: string) => void
  error?: string | null
}

export function PasswordStep({ password, onChange, error }: PasswordStepProps) {
  return (
    <div className="space-y-4">
      <div>
        <Heading level={2} tabIndex={-1}>Wallet password</Heading>
        <Text className="mt-1">
          For fnn to use on startup. Stored in your OS keychain.
        </Text>
      </div>

      <Field>
        <Label>Password</Label>
        <Input
          type="password"
          value={password}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Strong password"
          autoComplete="new-password"
          data-invalid={error ? true : undefined}
        />
        {error ? <ErrorMessage>{error}</ErrorMessage> : null}
      </Field>
    </div>
  )
}
