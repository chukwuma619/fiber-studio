export const GITHUB_REPO = 'chukwuma619/fiber-studio'
export const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`
export const LATEST_RELEASE_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`

export type ReleaseAsset = {
  name: string
  browser_download_url: string
  size: number
}

export type LatestRelease = {
  tag_name: string
  name: string
  html_url: string
  assets: ReleaseAsset[]
}

export type PlatformId =
  | 'macos-arm'
  | 'macos-intel'
  | 'windows'
  | 'linux-x64'
  | 'linux-arm'

export type DetectedPlatform = PlatformId | 'unknown'

export type DownloadOption = {
  label: string
  format: string
  href: string
  primary?: boolean
}

export type PlatformDownload = {
  id: PlatformId
  title: string
  subtitle: string
  install: string
  options: DownloadOption[]
}

function isInstallerAsset(name: string) {
  const lower = name.toLowerCase()
  if (lower.endsWith('.sig')) return false
  if (lower === 'latest.json') return false
  if (lower.includes('.app.tar.gz')) return false
  return (
    lower.endsWith('.dmg') ||
    lower.endsWith('.exe') ||
    lower.endsWith('.msi') ||
    lower.endsWith('.appimage') ||
    lower.endsWith('.deb') ||
    lower.endsWith('.rpm')
  )
}

function findAsset(assets: ReleaseAsset[], test: (name: string) => boolean) {
  return assets.find((asset) => isInstallerAsset(asset.name) && test(asset.name.toLowerCase()))
}

function option(
  asset: ReleaseAsset | undefined,
  label: string,
  format: string,
  primary = false,
): DownloadOption | null {
  if (!asset) return null
  return {
    label,
    format,
    href: asset.browser_download_url,
    primary,
  }
}

function options(...items: Array<DownloadOption | null>): DownloadOption[] {
  return items.filter((item): item is DownloadOption => item !== null)
}

export function buildPlatformDownloads(assets: ReleaseAsset[]): PlatformDownload[] {
  const macosArm = findAsset(assets, (n) => n.includes('aarch64') && n.endsWith('.dmg'))
  const macosIntel = findAsset(
    assets,
    (n) => n.includes('_x64') && n.endsWith('.dmg') && !n.includes('aarch64'),
  )
  const windowsExe = findAsset(assets, (n) => n.includes('x64-setup.exe'))
  const windowsMsi = findAsset(assets, (n) => n.endsWith('.msi'))
  const linuxX64AppImage = findAsset(
    assets,
    (n) => n.includes('amd64') && n.endsWith('.appimage'),
  )
  const linuxX64Deb = findAsset(assets, (n) => n.includes('amd64') && n.endsWith('.deb'))
  const linuxX64Rpm = findAsset(
    assets,
    (n) => n.includes('x86_64') && n.endsWith('.rpm'),
  )
  const linuxArmAppImage = findAsset(
    assets,
    (n) => n.includes('aarch64') && n.endsWith('.appimage'),
  )
  const linuxArmDeb = findAsset(assets, (n) => n.includes('arm64') && n.endsWith('.deb'))
  const linuxArmRpm = findAsset(
    assets,
    (n) => n.includes('aarch64') && n.endsWith('.rpm'),
  )

  const platforms: PlatformDownload[] = [
    {
      id: 'macos-arm',
      title: 'macOS',
      subtitle: 'Apple Silicon (M1–M4)',
      install: 'Open the DMG and drag Fiber Studio to Applications.',
      options: options(option(macosArm, 'Download DMG', '.dmg', true)),
    },
    {
      id: 'macos-intel',
      title: 'macOS',
      subtitle: 'Intel',
      install: 'Open the DMG and drag Fiber Studio to Applications.',
      options: options(option(macosIntel, 'Download DMG', '.dmg', true)),
    },
    {
      id: 'windows',
      title: 'Windows',
      subtitle: '64-bit',
      install: 'Run the setup wizard. Prefer the NSIS setup (.exe).',
      options: options(
        option(windowsExe, 'Download setup', '.exe', true),
        option(windowsMsi, 'Download MSI', '.msi'),
      ),
    },
    {
      id: 'linux-x64',
      title: 'Linux',
      subtitle: 'x64',
      install:
        'AppImage: chmod +x then run. Debian/Ubuntu: sudo apt install ./….deb. Fedora/RHEL: sudo dnf install ./….rpm.',
      options: options(
        option(linuxX64AppImage, 'Download AppImage', '.AppImage', true),
        option(linuxX64Deb, 'Download DEB', '.deb'),
        option(linuxX64Rpm, 'Download RPM', '.rpm'),
      ),
    },
    {
      id: 'linux-arm',
      title: 'Linux',
      subtitle: 'ARM64',
      install:
        'AppImage: chmod +x then run. Debian/Ubuntu: sudo apt install ./….deb. Fedora/RHEL: sudo dnf install ./….rpm.',
      options: options(
        option(linuxArmAppImage, 'Download AppImage', '.AppImage', true),
        option(linuxArmDeb, 'Download DEB', '.deb'),
        option(linuxArmRpm, 'Download RPM', '.rpm'),
      ),
    },
  ]

  return platforms.filter((platform) => platform.options.length > 0)
}

export function detectPlatformSync(): DetectedPlatform {
  if (typeof navigator === 'undefined') return 'unknown'

  const ua = navigator.userAgent
  const platform = navigator.platform || ''
  const isMac = /Mac|iPhone|iPad|iPod/i.test(ua) || platform.startsWith('Mac')
  const isWindows = /Win/i.test(ua) || platform.startsWith('Win')
  const isLinux = /Linux/i.test(ua) && !/Android/i.test(ua)

  if (isMac) {
    // Most Macs are Apple Silicon; navigator.platform is often "MacIntel" on both.
    return 'macos-arm'
  }
  if (isWindows) return 'windows'
  if (isLinux) {
    if (/aarch64|arm64/i.test(ua + platform)) return 'linux-arm'
    return 'linux-x64'
  }
  return 'unknown'
}

export async function detectPlatform(): Promise<DetectedPlatform> {
  const sync = detectPlatformSync()
  if (typeof navigator === 'undefined') return sync

  const uaData = (
    navigator as Navigator & {
      userAgentData?: {
        platform?: string
        getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string }>
      }
    }
  ).userAgentData

  if (!uaData?.getHighEntropyValues) return sync

  try {
    const { architecture } = await uaData.getHighEntropyValues(['architecture'])
    const platform = (uaData.platform || '').toLowerCase()
    const isArm = architecture === 'arm'

    if (platform.includes('mac') || sync === 'macos-arm' || sync === 'macos-intel') {
      return isArm ? 'macos-arm' : 'macos-intel'
    }
    if (platform.includes('win') || sync === 'windows') return 'windows'
    if (platform.includes('linux') || sync === 'linux-x64' || sync === 'linux-arm') {
      return isArm ? 'linux-arm' : 'linux-x64'
    }
  } catch {
    // Fall through to sync detection.
  }

  return sync
}

/** Server-side fetch of the latest GitHub release. */
export async function fetchLatestRelease(): Promise<LatestRelease> {
  const response = await fetch(LATEST_RELEASE_API, {
    headers: { Accept: 'application/vnd.github+json' },
    next: { revalidate: 300 },
  })

  if (!response.ok) {
    throw new Error(`GitHub releases returned ${response.status}`)
  }

  const data = (await response.json()) as LatestRelease
  return {
    tag_name: data.tag_name,
    name: data.name,
    html_url: data.html_url,
    assets: (data.assets ?? []).map((asset) => ({
      name: asset.name,
      browser_download_url: asset.browser_download_url,
      size: asset.size,
    })),
  }
}
