import type { Metadata } from 'next'

import { GetStartedPage } from '@/component/get-started/get-started-page'

export const metadata: Metadata = {
  title: 'Get started',
  description:
    'Step-by-step guide: install Fiber Studio, start your Fiber node, open a CKB or UDT channel, send or receive on testnet, and try Lightning via CCH.',
}

export default function Page() {
  return <GetStartedPage />
}
