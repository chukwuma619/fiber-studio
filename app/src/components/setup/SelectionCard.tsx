import clsx from "clsx"
import type { ReactNode } from "react"

type SelectionCardProps = {
  selected: boolean
  onClick: () => void
  title: string
  description: string
  badge?: ReactNode
  disabled?: boolean
  role?: "radio" | "button"
}

export function SelectionCard({
  selected,
  onClick,
  title,
  description,
  badge,
  disabled = false,
  role = "button",
}: SelectionCardProps) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={role === "radio" ? selected : undefined}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "rounded-lg border p-4 text-left transition-colors",
        disabled
          ? "cursor-not-allowed border-zinc-950/5 bg-zinc-50 opacity-60 dark:border-white/5 dark:bg-zinc-950"
          : selected
            ? "border-sky-500 bg-sky-50 ring-1 ring-sky-500 dark:border-sky-400 dark:bg-sky-500/10 dark:ring-sky-400"
            : "border-zinc-950/10 bg-white hover:border-zinc-950/20 dark:border-white/10 dark:bg-zinc-900 dark:hover:border-white/20",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold tracking-[-0.28px] text-zinc-950 dark:text-white">
          {title}
        </span>
        {badge}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        {description}
      </p>
    </button>
  )
}
