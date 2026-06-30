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
        <Text className="mt-1 leading-relaxed">
          Choose a password to protect your key on this computer. Fiber uses it
          to unlock your wallet when the node starts.
        </Text>
      </div>

      <Field>
        <Label>Password</Label>
        <Input
          type="password"
          value={password}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Enter a strong password"
          autoComplete="new-password"
          data-invalid={error ? true : undefined}
        />
        {error ? <ErrorMessage>{error}</ErrorMessage> : null}
      </Field>

      <div className="rounded-lg bg-zinc-950/2.5 px-4 py-3 ring-1 ring-zinc-950/5 dark:bg-white/5 dark:ring-white/10">
        <p className="text-xs font-medium text-zinc-950 dark:text-white">
          OS keychain storage
        </p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Fiber Studio will store this password in your OS keychain so fnn can
          start without prompting each time.
        </p>
      </div>
    </div>
  )
}
