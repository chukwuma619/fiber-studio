import type { ReactNode } from "react"
import { Subheading } from "../ui/heading"
import { Text } from "../ui/text"

type SettingsSectionProps = {
  title: string
  subtitle?: string
  children: ReactNode
  actions?: ReactNode
}

export function SettingsSection({
  title,
  subtitle,
  children,
  actions,
}: SettingsSectionProps) {
  return (
    <section className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
      <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <div>
          <Subheading level={2}>{title}</Subheading>
          {subtitle ? (
            <Text className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {subtitle}
            </Text>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  )
}

type SettingsRowProps = {
  label: string
  value: ReactNode
  mono?: boolean
}

export function SettingsRow({ label, value, mono = false }: SettingsRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4 text-sm">
      <dt className="text-zinc-600 dark:text-zinc-400">{label}</dt>
      <dd
        className={
          mono
            ? "max-w-[60%] break-all text-right font-mono text-xs text-zinc-600 dark:text-zinc-400"
            : "text-right font-medium text-zinc-950 dark:text-white"
        }
      >
        {value}
      </dd>
    </div>
  )
}

export function SettingsRows({ children }: { children: ReactNode }) {
  return (
    <dl className="divide-y divide-zinc-200 dark:divide-zinc-800">{children}</dl>
  )
}
