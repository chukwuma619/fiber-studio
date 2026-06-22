import clsx from "clsx"
import { FiberMarkIcon } from "./FiberMarkIcon"
import { FiberStudioWordmark } from "./FiberStudioWordmark"

type FiberStudioLogoProps = {
  className?: string
  iconClassName?: string
  subtitle?: string
}

export function FiberStudioLogo({
  className,
  iconClassName,
  subtitle,
}: FiberStudioLogoProps) {
  return (
    <div className={clsx("flex items-center gap-2.5", className)}>
      <FiberMarkIcon className={clsx("size-9", iconClassName)} />
      <FiberStudioWordmark subtitle={subtitle} />
    </div>
  )
}
