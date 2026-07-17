const START_NODE_ON_LAUNCH_KEY = "fiber-studio-start-node-on-launch"
const LAUNCH_AT_LOGIN_KEY = "fiber-studio-launch-at-login"

function readBoolean(key: string, defaultValue: boolean): boolean {
  const stored = localStorage.getItem(key)
  if (stored === "true") return true
  if (stored === "false") return false
  return defaultValue
}

function writeBoolean(key: string, value: boolean): void {
  localStorage.setItem(key, String(value))
}

export function getStartNodeOnLaunch(): boolean {
  return readBoolean(START_NODE_ON_LAUNCH_KEY, false)
}

export function setStartNodeOnLaunch(enabled: boolean): void {
  writeBoolean(START_NODE_ON_LAUNCH_KEY, enabled)
}

export function getLaunchAtLogin(): boolean {
  return readBoolean(LAUNCH_AT_LOGIN_KEY, false)
}

export function setLaunchAtLogin(enabled: boolean): void {
  writeBoolean(LAUNCH_AT_LOGIN_KEY, enabled)
}
