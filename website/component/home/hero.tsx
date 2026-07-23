'use client'

import { motion, useReducedMotion } from 'motion/react'

import { Button } from '@/component/ui/button'
import { AppPreview } from '@/component/home/app-preview'
import { fadeUp, pageBodyEnter, pageHeaderEnter } from '@/lib/motion'

export function Hero() {
  const reduceMotion = useReducedMotion()
  const copy = fadeUp(12, reduceMotion)
  const preview = fadeUp(16, reduceMotion)

  return (
    <section className="pb-4 sm:pt-20">
      <motion.div
        initial={copy.initial}
        animate={copy.animate}
        transition={pageHeaderEnter}
        className="max-w-2xl"
      >
        <h1 className="text-4xl font-semibold tracking-[-2.4px] text-zinc-950 sm:text-6xl sm:tracking-[-3.84px] dark:text-white">
          A desktop app for Fiber Network payments.
        </h1>
        <p className="mt-4 max-w-xl text-base/6 text-zinc-600 sm:text-lg/7 dark:text-zinc-400">
          Run the official Fiber node on your computer, send and receive payments, and keep
          your keys on your device. No command line required. Testnet ready.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button href="/download">Download</Button>
          <Button href="/get-started" outline>
            Get started
          </Button>
        </div>
      </motion.div>

      <motion.div
        initial={preview.initial}
        animate={preview.animate}
        transition={pageBodyEnter}
        className="mt-12 sm:mt-14"
      >
        <AppPreview />
      </motion.div>
    </section>
  )
}
