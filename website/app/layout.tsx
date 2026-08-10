import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { SiteShell } from '@/component/site-shell'
import { ThemeProvider } from '@/component/theme-provider'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://www.getfiberstudio.com'),
  title: {
    default: 'Fiber Studio',
    template: '%s · Fiber Studio',
  },
  description:
    'Native desktop app for the Fiber Network on Nervos CKB — run channels, CKB and UDT payments, and your node without the terminal.',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://www.getfiberstudio.com',
    siteName: 'Fiber Studio',
    title: 'Fiber Studio',
    description:
      'Native desktop app for the Fiber Network on Nervos CKB — run channels, CKB and UDT payments, and your node without the terminal.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fiber Studio',
    description:
      'Native desktop app for the Fiber Network on Nervos CKB — run channels, CKB and UDT payments, and your node without the terminal.',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider>
          <SiteShell>{children}</SiteShell>
        </ThemeProvider>
      </body>
    </html>
  )
}
