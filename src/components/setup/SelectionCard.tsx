import clsx from "clsx"
import type { ReactNode } from "react"

type SelectionCardProps = {
  selected: boolean
  onClick: () => void
  title: string
  description: string
  badge?: ReactNode
  disabled?: boolean
}

export function SelectionCard({
  selected,
  onClick,
  title,
  description,
  badge,
  disabled = false,
}: SelectionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "rounded-lg border p-4 text-left transition-colors",
        disabled
          ? "cursor-not-allowed border-zinc-950/5 bg-zinc-50 opacity-60 dark:border-white/5 dark:bg-zinc-950"
          : selected
            ? "border-zinc-900 bg-zinc-950/2.5 ring-1 ring-zinc-900 dark:border-white dark:bg-white/5 dark:ring-white"
            : "border-zinc-950/10 bg-white hover:border-zinc-950/20 dark:border-white/10 dark:bg-zinc-900 dark:hover:border-white/20",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-zinc-950 dark:text-white">
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
