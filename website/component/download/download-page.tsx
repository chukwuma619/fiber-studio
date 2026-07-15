'use client'

import { motion } from 'motion/react'
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'

import { Button } from '@/component/ui/button'
import { Divider } from '@/component/ui/divider'
import { TextLink } from '@/component/ui/text'
import {
  buildPlatformDownloads,
  detectPlatform,
  detectPlatformSync,
  RELEASES_URL,
  type DetectedPlatform,
  type LatestRelease,
  type PlatformDownload,
  type PlatformId,
} from '@/lib/releases'

function subscribeNoop() {
  return () => {}
}

function getServerPlatform(): DetectedPlatform {
  return 'unknown'
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-zinc-50 px-4 py-3 text-sm/6 text-zinc-600 ring-1 ring-zinc-950/10 dark:bg-zinc-800/60 dark:text-zinc-400 dark:ring-white/10">
      {children}
    </p>
  )
}

function Ui({ children }: { children: ReactNode }) {
  return (
    <span className="font-medium text-zinc-950 dark:text-white">{children}</span>
  )
}

function PlatformRow({
  platform,
  recommended,
}: {
  platform: PlatformDownload
  recommended: boolean
}) {
  const primary = platform.options.find((option) => option.primary) ?? platform.options[0]
  const secondary = platform.options.filter((option) => option !== primary)

  return (
    <li>
      <Divider soft />
      <div className="flex flex-col gap-5 py-8 sm:flex-row sm:items-start sm:justify-between sm:gap-10">
        <div className="min-w-0 max-w-xl">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-lg/7 font-semibold tracking-[-0.48px] text-zinc-950 dark:text-white">
              {platform.title}
            </h3>
            <p className="text-sm/5 text-zinc-500 dark:text-zinc-400">{platform.subtitle}</p>
            {recommended ? (
              <span className="text-sm/5 font-medium text-sky-700 dark:text-sky-400">
                Recommended for you
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm/6 text-zinc-600 dark:text-zinc-400">{platform.install}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {primary ? (
            <Button href={primary.href} target="_blank" rel="noopener noreferrer">
              {primary.label}
            </Button>
          ) : null}
          {secondary.map((option) => (
            <Button
              key={option.href}
              href={option.href}
              outline
              target="_blank"
              rel="noopener noreferrer"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
    </li>
  )
}

function AfterInstallNotes({ platform }: { platform: DetectedPlatform }) {
  const showMac = platform === 'macos-arm' || platform === 'macos-intel' || platform === 'unknown'
  const showWindows = platform === 'windows' || platform === 'unknown'

  return (
    <section className="mt-6 max-w-2xl">
      <h2 className="text-2xl/8 font-semibold tracking-[-0.96px] text-zinc-950 sm:text-[32px]/[40px] sm:tracking-[-1.28px] dark:text-white">
        After you install
      </h2>
      <p className="mt-4 text-base/7 text-zinc-600 dark:text-zinc-400">
        Builds are not Apple-notarized or Windows-signed yet. Your OS may warn on first launch —
        that is expected for GitHub downloads today.
      </p>

      {showMac ? (
        <div className="mt-8">
          <h3 className="text-base/6 font-semibold tracking-[-0.32px] text-zinc-950 dark:text-white">
            macOS Gatekeeper
          </h3>
          <p className="mt-3 text-base/7 text-zinc-600 dark:text-zinc-400">
            Gatekeeper may show <Ui>“Fiber Studio” Not Opened</Ui> with only <Ui>Done</Ui> and{' '}
            <Ui>Move to Bin</Ui>. Do not click Move to Bin.
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-base/7 text-zinc-600 marker:font-medium marker:text-zinc-950 dark:text-zinc-400 dark:marker:text-white">
            <li>Open the DMG and drag Fiber Studio to Applications.</li>
            <li>Open the app once — Gatekeeper will block it.</li>
            <li>
              Open <Ui>System Settings → Privacy & Security</Ui>, find the Fiber Studio message, and
              click <Ui>Open Anyway</Ui>.
            </li>
            <li>
              Or in Finder: right-click Fiber Studio → <Ui>Open</Ui> → <Ui>Open</Ui>.
            </li>
          </ol>
        </div>
      ) : null}

      {showWindows ? (
        <div className="mt-8">
          <h3 className="text-base/6 font-semibold tracking-[-0.32px] text-zinc-950 dark:text-white">
            Windows SmartScreen
          </h3>
          <p className="mt-3 text-base/7 text-zinc-600 dark:text-zinc-400">
            If SmartScreen appears, choose <Ui>More info → Run anyway</Ui>.
          </p>
        </div>
      ) : null}

      <Note>
        After the first successful launch, the OS remembers your choice. In-app updates later use{' '}
        <Ui>Settings → Updates</Ui> — ignore <Ui>latest.json</Ui> and <Ui>*.app.tar.gz</Ui> on the
        release page; those are for the updater, not manual install.
      </Note>
    </section>
  )
}

export function DownloadPage({ release }: { release: LatestRelease | null }) {
  const syncDetected = useSyncExternalStore(
    subscribeNoop,
    detectPlatformSync,
    getServerPlatform,
  )
  const [refined, setRefined] = useState<DetectedPlatform | null>(null)

  useEffect(() => {
    let cancelled = false
    void detectPlatform().then((platform) => {
      if (!cancelled) setRefined(platform)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const detected = refined ?? syncDetected
  const platforms = release ? buildPlatformDownloads(release.assets) : []
  const recommended =
    detected === 'unknown'
      ? null
      : (platforms.find((platform) => platform.id === detected) ?? null)
  const others = recommended
    ? platforms.filter((platform) => platform.id !== recommended.id)
    : platforms
  const recommendedPrimary =
    recommended?.options.find((option) => option.primary) ?? recommended?.options[0]

  function platformLabel(id: PlatformId) {
    switch (id) {
      case 'macos-arm':
        return 'macOS Apple Silicon'
      case 'macos-intel':
        return 'macOS Intel'
      case 'windows':
        return 'Windows'
      case 'linux-x64':
        return 'Linux x64'
      case 'linux-arm':
        return 'Linux ARM64'
      default: {
        const _exhaustive: never = id
        return _exhaustive
      }
    }
  }

  return (
    <div className="pb-4 sm:pt-12">
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.175, 0.885, 0.32, 1.1] }}
        className="max-w-2xl"
      >
        <h1 className="text-4xl font-semibold tracking-[-2.4px] text-zinc-950 sm:text-6xl sm:tracking-[-3.84px] dark:text-white">
          Download Fiber Studio
        </h1>
        <p className="mt-4 max-w-xl text-base/6 text-zinc-600 sm:text-lg/7 dark:text-zinc-400">
          Get the desktop app for macOS, Windows, or Linux. Installers ship with each GitHub
          release. Testnet ready.
        </p>
        {release ? (
          <p className="mt-4 text-sm/6 text-zinc-500 dark:text-zinc-400">
            Latest release{' '}
            <TextLink href={release.html_url} target="_blank" rel="noopener noreferrer">
              {release.tag_name}
            </TextLink>
          </p>
        ) : (
          <p className="mt-4 text-sm/6 text-zinc-500 dark:text-zinc-400">
            Could not load release metadata. Browse{' '}
            <TextLink href={RELEASES_URL} target="_blank" rel="noopener noreferrer">
              GitHub Releases
            </TextLink>{' '}
            directly.
          </p>
        )}
        <div className="mt-8 flex flex-wrap gap-3">
          {recommended && recommendedPrimary ? (
            <Button href={recommendedPrimary.href} target="_blank" rel="noopener noreferrer">
              Download for {platformLabel(recommended.id)}
            </Button>
          ) : platforms.length > 0 ? (
            <Button href="#installers">Choose your platform</Button>
          ) : (
            <Button href={RELEASES_URL} target="_blank" rel="noopener noreferrer">
              View releases
            </Button>
          )}
          <Button href="/get-started" outline>
            Get started
          </Button>
        </div>
      </motion.header>

      <motion.section
        id="installers"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05, ease: [0.175, 0.885, 0.32, 1.1] }}
        className="mt-14 scroll-mt-24 sm:mt-16"
      >
        <h2 className="text-2xl/8 font-semibold tracking-[-0.96px] text-zinc-950 sm:text-[32px]/[40px] sm:tracking-[-1.28px] dark:text-white">
          Choose your platform
        </h2>
        <p className="mt-3 max-w-2xl text-base/7 text-zinc-600 dark:text-zinc-400">
          Download only the installer for your machine. Skip signature files,{' '}
          <Ui>latest.json</Ui>, and <Ui>*.app.tar.gz</Ui> — those are for in-app updates.
        </p>

        {platforms.length > 0 ? (
          <ul className="mt-6">
            {recommended ? <PlatformRow platform={recommended} recommended /> : null}
            {others.map((platform) => (
              <PlatformRow key={platform.id} platform={platform} recommended={false} />
            ))}
          </ul>
        ) : (
          <div className="mt-8">
            <Note>
              Release assets are unavailable right now. Use{' '}
              <TextLink href={RELEASES_URL} target="_blank" rel="noopener noreferrer">
                GitHub Releases
              </TextLink>{' '}
              and pick the installer for your OS.
            </Note>
          </div>
        )}
      </motion.section>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.25, ease: [0.175, 0.885, 0.32, 1.1] }}
        className="mt-10 sm:mt-14"
      >
        <Divider soft />
        <AfterInstallNotes platform={detected} />
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.25, ease: [0.175, 0.885, 0.32, 1.1] }}
        className="mt-14 max-w-2xl sm:mt-16"
      >
        <Divider soft />
        <div className="pt-14 sm:pt-16">
          <h2 className="text-2xl/8 font-semibold tracking-[-0.96px] text-zinc-950 sm:text-[32px]/[40px] sm:tracking-[-1.28px] dark:text-white">
            Next: set up your node
          </h2>
          <p className="mt-4 text-base/7 text-zinc-600 dark:text-zinc-400">
            After install, walk through the wizard: start your Fiber node, open a channel, then send
            or receive on testnet.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href="/get-started">Get started</Button>
            <Button href="/faq" outline>
              FAQ
            </Button>
          </div>
        </div>
      </motion.section>
    </div>
  )
}
