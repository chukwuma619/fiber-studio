import type { Metadata } from 'next'

import { GetStartedPage } from '@/component/get-started/get-started-page'

export const metadata: Metadata = {
  title: 'Get started — Fiber Studio',
  description:
    'Step-by-step guide: install Fiber Studio, start your Fiber node, open a channel, and send or receive CKB on testnet.',
}

export default function Page() {
  return <GetStartedPage />
}
