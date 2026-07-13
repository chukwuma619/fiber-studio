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
    <div className={clsx("flex items-center", className)}>
      <FiberMarkIcon className={clsx(iconClassName)} />
      <FiberStudioWordmark subtitle={subtitle} />
    </div>
  )
}
