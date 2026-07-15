type StatCardProps = {
  label: string
  value: string
  unit?: string
  subtext: string
}

export function StatCard({ label, value, unit, subtext }: StatCardProps) {
  return (
    <div className="rounded-lg bg-white p-6 shadow-xs ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10">
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-950 dark:text-white">
        {value}
        {unit ? (
          <span className="ml-1 text-base font-medium text-zinc-500 dark:text-zinc-400">{unit}</span>
        ) : null}
      </p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{subtext}</p>
    </div>
  )
}
