const ANSI_ESCAPE_PATTERN = /\u001b(?:\[[0-9;]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g

export function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE_PATTERN, "").trimEnd()
}

export function formatLogLines(lines: string[]): string {
  return lines.map(stripAnsi).filter(Boolean).join("\n")
}
