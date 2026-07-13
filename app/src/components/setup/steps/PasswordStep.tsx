import { Eye, EyeOff } from "lucide-react"
import { useState } from "react"
import { ErrorMessage, Field, Label } from "../../ui/fieldset"
import { Heading } from "../../ui/heading"
import { Input } from "../../ui/input"
import { Text } from "../../ui/text"

type PasswordStepProps = {
  password: string
  passwordConfirm: string
  onPasswordChange: (password: string) => void
  onPasswordConfirmChange: (passwordConfirm: string) => void
  error?: string | null
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggleShow,
  invalid,
  error,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  show: boolean
  onToggleShow: () => void
  invalid?: boolean
  error?: string | null
}) {
  return (
    <Field>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative" data-slot="control">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Strong password"
          autoComplete="new-password"
          data-invalid={invalid ? true : undefined}
          className="[&_input]:pr-10 sm:[&_input]:pr-9"
        />
        <button
          type="button"
          className="absolute top-1/2 right-3 z-10 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          onClick={onToggleShow}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}
    </Field>
  )
}

export function PasswordStep({
  password,
  passwordConfirm,
  onPasswordChange,
  onPasswordConfirmChange,
  error,
}: PasswordStepProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const invalid = Boolean(error)

  return (
    <div className="space-y-4">
      <div>
        <Heading level={2} tabIndex={-1}>Wallet password</Heading>
        <Text className="mt-1">
          For fnn to use on startup. Saved to your OS keychain when you finish
          setup.
        </Text>
      </div>

      <PasswordField
        id="setup-password"
        label="Password"
        value={password}
        onChange={onPasswordChange}
        show={showPassword}
        onToggleShow={() => setShowPassword((current) => !current)}
        invalid={invalid}
      />

      <PasswordField
        id="setup-password-confirm"
        label="Confirm password"
        value={passwordConfirm}
        onChange={onPasswordConfirmChange}
        show={showConfirm}
        onToggleShow={() => setShowConfirm((current) => !current)}
        invalid={invalid}
        error={error}
      />
    </div>
  )
}
