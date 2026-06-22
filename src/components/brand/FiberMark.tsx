import clsx from "clsx"

type FiberMarkProps = {
  className?: string
  title?: string
}

export function FiberMark({ className, title }: FiberMarkProps) {
  return (
    <svg
      viewBox="0 0 33 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={clsx(className)}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.72 12H23.5L26.5 7H8.5L7.72 12ZM9 36.5L19.5 18.5H12.83L14 13H7.56L6 23H11.87L9 36.5Z"
        fill="currentColor"
      />
    </svg>
  )
}
