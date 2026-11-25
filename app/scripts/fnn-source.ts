import { readFileSync } from "node:fs"
import { join } from "node:path"

export type FnnSource = {
  repo: string
  ref: string
  sha: string
  version: string
}

export function readFnnSource(): FnnSource {
  const text = readFileSync(join(import.meta.dirname, "fnn-source.env"), "utf8")
  const values = new Map<string, string>()
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue
    }
    const separator = trimmed.indexOf("=")
    if (separator === -1) {
      continue
    }
    values.set(trimmed.slice(0, separator), trimmed.slice(separator + 1))
  }

  const repo = values.get("FNN_GIT_REPO")
  const ref = values.get("FNN_GIT_REF")
  const sha = values.get("FNN_GIT_SHA")
  const version = values.get("FNN_VERSION")
  if (!repo || !ref || !sha || !version) {
    throw new Error("fnn-source.env must set FNN_GIT_REPO, FNN_GIT_REF, FNN_GIT_SHA, and FNN_VERSION")
  }
  return { repo, ref, sha, version }
}
