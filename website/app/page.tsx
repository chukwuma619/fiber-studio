import { DownloadCta } from '@/component/home/download-cta'
import { Hero } from '@/component/home/hero'
import { HowItWorks } from '@/component/home/how-it-works'
import { Trust } from '@/component/home/trust'
import { WhatItIs } from '@/component/home/what-it-is'

export default function Home() {
  return (
    <>
      <Hero />
      <WhatItIs />
      <HowItWorks />
      <Trust />
      <DownloadCta />
    </>
  )
}
