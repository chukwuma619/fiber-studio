/**
 * Download fnn release binaries for Tauri sidecar bundling.
 *
 * Usage:
 *   bun run fetch-fnn           # current host only
 *   bun run fetch-fnn -- --all                    # all supported platforms
 *   bun run fetch-fnn -- --triple aarch64-apple-darwin  # one platform (CI)
 */

import { execSync } from "node:child_process"
import { createWriteStream, existsSync, mkdirSync, rmSync } from "node:fs"
import { chmodSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pipeline } from "node:stream/promises"

const FNN_VERSION = "0.9.0-rc7"
const RELEASE_BASE = `https://github.com/nervosnetwork/fiber/releases/download/v${FNN_VERSION}`
const BINARIES_DIR = join(import.meta.dirname, "..", "src-tauri", "binaries")

type PlatformTarget = {
  triple: string
  asset: string
  binaryName: string
}

const PLATFORMS: PlatformTarget[] = [
  {
    triple: "aarch64-apple-darwin",
    asset: `fnn_v${FNN_VERSION}-aarch64-darwin-portable.tar.gz`,
    binaryName: "fnn",
  },
  {
    triple: "x86_64-apple-darwin",
    asset: `fnn_v${FNN_VERSION}-x86_64-darwin-portable.tar.gz`,
    binaryName: "fnn",
  },
  {
    triple: "x86_64-unknown-linux-gnu",
    asset: `fnn_v${FNN_VERSION}-x86_64-linux-portable.tar.gz`,
    binaryName: "fnn",
  },
  {
    triple: "aarch64-unknown-linux-gnu",
    asset: `fnn_v${FNN_VERSION}-aarch64-linux-portable.tar.gz`,
    binaryName: "fnn",
  },
  {
    triple: "x86_64-pc-windows-msvc",
    asset: `fnn_v${FNN_VERSION}-x86_64-windows.tar.gz`,
    binaryName: "fnn.exe",
  },
]

function hostTriple(): string {
  return execSync("rustc --print host-tuple", { encoding: "utf8" }).trim()
}

function sidecarFilename(triple: string, binaryName: string): string {
  const isWindows = triple.includes("windows")
  const base = `fnn-${triple}`
  return isWindows ? `${base}.exe` : base
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`)
  }
  await pipeline(response.body, createWriteStream(dest))
}

async function fetchPlatform(platform: PlatformTarget): Promise<void> {
  const destPath = join(BINARIES_DIR, sidecarFilename(platform.triple, platform.binaryName))
  const url = `${RELEASE_BASE}/${platform.asset}`

  console.log(`Fetching ${platform.triple} from ${url}`)

  const workDir = join(tmpdir(), `fiber-studio-fnn-${platform.triple}`)
  rmSync(workDir, { recursive: true, force: true })
  mkdirSync(workDir, { recursive: true })

  const archivePath = join(workDir, platform.asset)
  await downloadFile(url, archivePath)

  execSync(`tar -xzf "${archivePath}" -C "${workDir}"`, { stdio: "inherit" })

  const extractedBinary = join(workDir, platform.binaryName)
  if (!existsSync(extractedBinary)) {
    throw new Error(
      `Expected ${platform.binaryName} in archive for ${platform.triple}. Check release layout.`,
    )
  }

  mkdirSync(BINARIES_DIR, { recursive: true })
  const { copyFileSync } = await import("node:fs")
  copyFileSync(extractedBinary, destPath)

  if (!platform.triple.includes("windows")) {
    chmodSync(destPath, 0o755)
  }

  console.log(`Wrote ${destPath}`)
  rmSync(workDir, { recursive: true, force: true })
}

function parseTripleArg(): string | null {
  const flagIndex = process.argv.indexOf("--triple")
  if (flagIndex === -1 || flagIndex + 1 >= process.argv.length) {
    return null
  }
  return process.argv[flagIndex + 1]
}

async function main(): Promise<void> {
  const fetchAll = process.argv.includes("--all")
  const explicitTriple = parseTripleArg()
  const targets = fetchAll
    ? PLATFORMS
    : explicitTriple
      ? PLATFORMS.filter((platform) => platform.triple === explicitTriple)
      : PLATFORMS.filter((platform) => platform.triple === hostTriple())

  if (targets.length === 0) {
    const triple = explicitTriple ?? hostTriple()
    throw new Error(
      `Unsupported triple "${triple}". Supported: ${PLATFORMS.map((p) => p.triple).join(", ")}`,
    )
  }

  for (const platform of targets) {
    await fetchPlatform(platform)
  }

  console.log(`Done. fnn v${FNN_VERSION} sidecar binaries are in ${BINARIES_DIR}`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
