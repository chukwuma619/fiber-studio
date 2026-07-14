import type { Metadata } from 'next'

import { DownloadPage } from '@/component/download/download-page'
import { fetchLatestRelease, type LatestRelease } from '@/lib/releases'

export const metadata: Metadata = {
  title: 'Download — Fiber Studio',
  description:
    'Download Fiber Studio for macOS, Windows, or Linux. Install from the latest GitHub release and set up your local Fiber node.',
}

export default async function Page() {
  let release: LatestRelease | null = null
  try {
    release = await fetchLatestRelease()
  } catch {
    release = null
  }

  return <DownloadPage release={release} />
}
