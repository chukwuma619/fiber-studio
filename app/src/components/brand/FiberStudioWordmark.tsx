import clsx from "clsx"

type FiberStudioWordmarkProps = {
  className?: string
  subtitle?: string
  layout?: "inline" | "stacked"
}

export function FiberStudioWordmark({
  className,
  subtitle,
  layout = "stacked",
}: FiberStudioWordmarkProps) {
  const wordmark = (
    <>
      <span className="font-semibold">Fiber</span>{" "}
      <span className="font-normal text-zinc-500 dark:text-zinc-400">Studio</span>
    </>
  )

  if (layout === "inline") {
    return (
      <span className={clsx("text-sm/5 font-medium text-zinc-950 dark:text-white", className)}>
        {wordmark}
      </span>
    )
  }

  return (
    <div className={className}>
      <p className="text-sm font-medium leading-tight text-zinc-950 dark:text-white">
        {wordmark}
      </p>
      {subtitle ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
      ) : null}
    </div>
  )
}
