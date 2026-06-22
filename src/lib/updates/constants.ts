export const GITHUB_REPO = "chukwuma619/fiber-studio"
export const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`
export const UPDATE_CHECK_DELAY_MS = 2500

export function releaseNotesUrl(version: string): string {
  const normalized = version.replace(/^v/i, "")
  return `${RELEASES_URL}/tag/v${normalized}`
}
