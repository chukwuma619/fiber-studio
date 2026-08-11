import type { Metadata } from 'next'

import { FaqPage } from '@/component/faq/faq-page'

export const metadata: Metadata = {
  title: 'FAQ',
  description:
    'Answers about Fiber Studio: local nodes, testnet, CKB and UDT payments, Bitcoin Lightning via CCH, channels vs peers, and first-launch warnings.',
}

export default function Page() {
  return <FaqPage />
}
