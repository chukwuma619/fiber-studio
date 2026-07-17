import { CircleHelp } from "lucide-react"
import { useId, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

type HelpTooltipProps = {
  content: string
  label?: string
}

export function HelpTooltip({ content, label = "More information" }: HelpTooltipProps) {
  const tooltipId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setCoords(null)
      return
    }

    const rect = triggerRef.current.getBoundingClientRect()
    setCoords({
      top: rect.bottom + 6,
      left: rect.left + rect.width / 2,
    })
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex shrink-0 rounded-full text-zinc-400 transition hover:text-zinc-600 focus:outline-hidden focus-visible:text-zinc-600 focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-zinc-500 dark:hover:text-zinc-300 dark:focus-visible:text-zinc-300"
        aria-label={label}
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => !current)
        }}
      >
        <CircleHelp className="size-3.5" aria-hidden="true" />
      </button>
      {open && coords
        ? createPortal(
            <span
              id={tooltipId}
              role="tooltip"
              className="pointer-events-none fixed z-50 w-max max-w-56 -translate-x-1/2 rounded-md bg-zinc-900 px-2.5 py-1.5 text-left text-xs leading-snug font-normal whitespace-normal text-white shadow-lg dark:bg-zinc-700"
              style={{ top: coords.top, left: coords.left }}
            >
              {content}
            </span>,
            document.body,
          )
        : null}
    </>
  )
}
