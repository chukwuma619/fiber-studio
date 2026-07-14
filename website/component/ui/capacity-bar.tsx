type CapacityBarProps = {
  percent: number
  showLabel?: boolean
}

export function CapacityBar({ percent, showLabel = true }: CapacityBarProps) {
  const tone =
    percent < 15 ? 'bg-amber-500 dark:bg-amber-400' : 'bg-teal-500 dark:bg-teal-400'

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label="Local liquidity share"
          className={`h-full rounded-full ${tone}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showLabel ? (
        <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{percent}%</span>
      ) : null}
    </div>
  )
}
