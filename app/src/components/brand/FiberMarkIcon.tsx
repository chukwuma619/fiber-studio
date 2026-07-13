import type { ComponentPropsWithoutRef } from "react"
import { FiberMark } from "./FiberMark"

type FiberMarkIconProps = ComponentPropsWithoutRef<"span"> & {
  title?: string
}

export function FiberMarkIcon({
  title = "Fiber Studio",
  ...props
}: FiberMarkIconProps) {
  return (

      <FiberMark className="size-6" title={title} {...props} />
  )
}
