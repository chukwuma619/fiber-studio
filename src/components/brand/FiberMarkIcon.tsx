import clsx from "clsx"
import type { ComponentPropsWithoutRef } from "react"
import { FiberMark } from "./FiberMark"

type FiberMarkIconProps = ComponentPropsWithoutRef<"span"> & {
  title?: string
}

export function FiberMarkIcon({
  className,
  title = "Fiber Studio",
  ...props
}: FiberMarkIconProps) {
  return (
    <span
      {...props}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900",
        className,
      )}
    >
      <FiberMark className="size-[62.5%]" title={title} />
    </span>
  )
}
