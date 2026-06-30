import clsx from "clsx"

type SegmentedControlProps<T extends string> = {
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="inline-flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={clsx(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            option.value === value
              ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-700 dark:text-white"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
