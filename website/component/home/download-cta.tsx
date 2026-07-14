'use client'

import { motion } from 'motion/react'

import { Button } from '@/component/ui/button'
import { Divider } from '@/component/ui/divider'

export function DownloadCta() {
  return (
    <section className="pt-16 sm:pt-20">
      <Divider soft />
      <div className="pt-16 pb-4 sm:pt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="max-w-2xl"
        >
          <h2 className="text-2xl/8 font-semibold tracking-[-0.96px] text-zinc-950 sm:text-[32px]/[40px] sm:tracking-[-1.28px] dark:text-white">
            Ready to run Fiber on your desktop.
          </h2>
          <p className="mt-4 max-w-xl text-base/6 text-zinc-600 sm:text-lg/7 dark:text-zinc-400">
            Download Fiber Studio and get started on testnet. Your keys stay on your
            device.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href="/download">Download</Button>
            <Button href="/get-started" outline>
              Get started
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
