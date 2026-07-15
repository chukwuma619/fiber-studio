/** Geist ease — matches `--ease-geist` in index.css / website hero. */
export const easeGeist = [0.175, 0.885, 0.32, 1.1] as const

export const pageEnter = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.2, ease: easeGeist },
} as const

export const stepEnter = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.22, ease: easeGeist },
} as const

export const indicatorTransition = {
  duration: 0.2,
  ease: easeGeist,
} as const
