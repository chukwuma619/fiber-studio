/**
 * Bump app version across package.json and src-tauri/Cargo.toml.
 * Tauri reads version from package.json via tauri.conf.json ("version": "../package.json").
 *
 * Usage:
 *   bun run version:bump patch
 *   bun run version:bump minor
 *   bun run version:bump major
 *   bun run version:bump 0.2.0
 */

import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = join(import.meta.dirname, "..")
const PACKAGE_JSON = join(ROOT, "package.json")
const CARGO_TOML = join(ROOT, "src-tauri", "Cargo.toml")

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/
const BUMP_KINDS = ["patch", "minor", "major"] as const

type BumpKind = (typeof BUMP_KINDS)[number]

function usage(): never {
  console.error(`Usage: bun run version:bump <patch|minor|major|x.y.z>`)
  process.exit(1)
}

function parseSemver(version: string): { major: number; minor: number; patch: number } {
  const match = version.match(SEMVER_RE)
  if (!match) {
    throw new Error(`Invalid semver: ${version}`)
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  }
}

function bumpKind(version: string, kind: BumpKind): string {
  const { major, minor, patch } = parseSemver(version)
  switch (kind) {
    case "patch":
      return `${major}.${minor}.${patch + 1}`
    case "minor":
      return `${major}.${minor + 1}.0`
    case "major":
      return `${major + 1}.0.0`
    default: {
      const unreachable: never = kind
      throw new Error(`Unhandled bump kind: ${unreachable}`)
    }
  }
}

function resolveNextVersion(current: string, arg: string | undefined): string {
  if (!arg) {
    usage()
  }

  if ((BUMP_KINDS as readonly string[]).includes(arg)) {
    return bumpKind(current, arg as BumpKind)
  }

  parseSemver(arg)
  return arg
}

function updatePackageJson(version: string): void {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf8")) as { version: string }
  pkg.version = version
  writeFileSync(PACKAGE_JSON, `${JSON.stringify(pkg, null, 2)}\n`)
}

function updateCargoToml(version: string): void {
  const cargo = readFileSync(CARGO_TOML, "utf8")
  const updated = cargo.replace(/^version\s*=\s*"[^"]*"/m, `version = "${version}"`)
  if (updated === cargo) {
    throw new Error(`Could not find version field in ${CARGO_TOML}`)
  }
  writeFileSync(CARGO_TOML, updated)
}

const arg = process.argv[2]
const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf8")) as { version: string }
const current = pkg.version
const next = resolveNextVersion(current, arg)

if (next === current) {
  console.log(`Version unchanged: ${current}`)
  process.exit(0)
}

updatePackageJson(next)
updateCargoToml(next)

console.log(`Bumped version: ${current} → ${next}`)
console.log("Updated: package.json, src-tauri/Cargo.toml")
console.log("Tauri version is read from package.json via tauri.conf.json")
