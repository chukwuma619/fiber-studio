'use client'

import { motion } from 'motion/react'

import { Button } from '@/component/ui/button'
import { AppPreview } from '@/component/home/app-preview'

export function Hero() {
  return (
    <section className="pb-4 sm:pt-20">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.175, 0.885, 0.32, 1.1] }}
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05, ease: [0.175, 0.885, 0.32, 1.1] }}
        className="mt-12 sm:mt-14"
      >
        <AppPreview />
      </motion.div>
    </section>
  )
}
