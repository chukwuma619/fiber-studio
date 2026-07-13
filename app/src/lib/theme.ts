export type Theme = "light" | "dark" | "system"

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

export function resolveDark(theme: Theme): boolean {
  if (theme === "dark") return true
  if (theme === "light") return false
  return systemPrefersDark()
}

export function getStoredTheme(): Theme {
  const stored = localStorage.getItem("theme")
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored
  }
  return "system"
}

export function applyTheme(theme: Theme): void {
  if (theme === "system") {
    localStorage.removeItem("theme")
  } else {
    localStorage.theme = theme
  }

  document.documentElement.classList.toggle("dark", resolveDark(theme))
}

export function initTheme(): void {
  applyTheme(getStoredTheme())

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (getStoredTheme() === "system") {
      applyTheme("system")
    }
  })
}
