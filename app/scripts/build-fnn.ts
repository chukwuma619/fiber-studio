/**
 * Build fnn from a local Fiber checkout and install the Tauri sidecar.
 *
 *   bun run build-fnn
 *   bun run build-fnn -- --source /path/to/fiber
 */

import { execSync } from "node:child_process"
import { join } from "node:path"
import { readFnnSource } from "./fnn-source"

function sourcePath(): string {
  const flag = process.argv.indexOf("--source")
  if (flag !== -1 && process.argv[flag + 1]) {
    return process.argv[flag + 1]
  }
  if (process.env.FIBER_SRC) {
    return process.env.FIBER_SRC
  }
  return join(import.meta.dirname, "..", "..", "..", "fiber")
}

function main(): void {
  const source = sourcePath()
  const pin = readFnnSource()
  const sha = execSync("git rev-parse HEAD", { cwd: source, encoding: "utf8" }).trim()
  if (sha !== pin.sha) {
    console.warn(
      `Local Fiber is ${sha}. Releases pin ${pin.ref} at ${pin.sha}. Building this checkout.`,
    )
  }

  const script = process.platform === "win32" ? "build-fnn-sidecar.ps1" : "build-fnn-sidecar.sh"
  const command =
    process.platform === "win32"
      ? `powershell -NoProfile -ExecutionPolicy Bypass -File "${join(import.meta.dirname, script)}"`
      : `bash "${join(import.meta.dirname, script)}"`

  execSync(command, {
    stdio: "inherit",
    env: {
      ...process.env,
      FIBER_SRC: source,
      STUDIO_APP: join(import.meta.dirname, ".."),
    },
  })
}

main()
