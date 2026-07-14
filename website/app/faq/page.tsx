import type { Metadata } from 'next'

import { FaqPage } from '@/component/faq/faq-page'

export const metadata: Metadata = {
  title: 'FAQ — Fiber Studio',
  description:
    'Answers about Fiber Studio: local nodes, testnet, channels vs peers, install warnings, and first payments.',
}

export default function Page() {
  return <FaqPage />
}
