import { Field, Label } from "../../ui/fieldset"
import { Heading } from "../../ui/heading"
import { Input } from "../../ui/input"
import { Text } from "../../ui/text"

type PasswordStepProps = {
  password: string
  onChange: (password: string) => void
}

export function PasswordStep({ password, onChange }: PasswordStepProps) {
  return (
    <div className="space-y-4">
      <div>
        <Heading level={2}>Wallet password</Heading>
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
        />
      </Field>

      <div className="rounded-lg bg-sky-500/10 px-4 py-3 ring-1 ring-sky-500/20 dark:bg-sky-500/10 dark:ring-sky-500/20">
        <p className="text-xs font-medium text-sky-800 dark:text-sky-300">
          OS keychain storage
        </p>
        <p className="mt-1 text-xs leading-relaxed text-sky-700 dark:text-sky-400">
          Fiber Studio will store this password in your OS keychain so fnn can
          start without prompting each time.
        </p>
      </div>
    </div>
  )
}
