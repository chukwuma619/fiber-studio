'use client'

import { motion } from 'motion/react'
import { FiberMark } from '@/component/brand/FiberMark'
import { FiberStudioWordmark } from '@/component/brand/FiberStudioWordmark'
import { Button } from '@/component/ui/button'
import { Text } from '@/component/ui/text'
import { AppPreview } from '@/component/home/app-preview'

export function Hero() {
  return (
    <section className="pb-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="max-w-2xl"
      >
        <div className="mb-5 flex items-center gap-3 text-zinc-950 dark:text-white">
          <FiberMark className="h-10 w-auto sm:h-12" title="Fiber" />
          <FiberStudioWordmark layout="display" />
        </div>

        <p className="text-lg/8 font-medium text-zinc-950 sm:text-xl/8 dark:text-white">
          Run and manage your Fiber Network Node from one desktop app.
        </p>
        <Text className="mt-3 max-w-xl text-base/7 sm:text-base/7">
          Fiber Studio wraps the official Fiber Network Node (
          <span className="font-medium text-zinc-950 dark:text-white">fnn</span>) so you
          can start the node, open channels, and send or receive payments without living in
          a terminal. Your node runs locally — not a hosted wallet. Setup supports testnet
          today.
        </Text>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button href="/download" color="dark/zinc">
            Download
          </Button>
          <Button href="/get-started" outline>
            Get started
          </Button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.12, ease: 'easeOut' }}
        className="mt-12 sm:mt-14"
      >
        <AppPreview />
      </motion.div>
    </section>
  )
}
