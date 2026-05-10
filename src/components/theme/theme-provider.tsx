'use client'

import * as React from 'react'

type Theme = 'light' | 'dark'
const STORAGE_KEY = '1to1.theme'

interface ThemeContext {
  theme: Theme
  setTheme: (t: Theme) => void
  toggle: () => void
}

const Ctx = React.createContext<ThemeContext | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>('light')

  React.useEffect(() => {
    const stored = (typeof window !== 'undefined' && (localStorage.getItem(STORAGE_KEY) as Theme | null)) || null
    const initial: Theme = stored ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    setThemeState(initial)
    apply(initial)
  }, [])

  const setTheme = React.useCallback((t: Theme) => {
    setThemeState(t)
    apply(t)
    try { localStorage.setItem(STORAGE_KEY, t) } catch {}
  }, [])

  const toggle = React.useCallback(() => setTheme(theme === 'light' ? 'dark' : 'light'), [theme, setTheme])

  return (
    <Ctx.Provider value={{ theme, setTheme, toggle }}>
      <NoFlashScript />
      {children}
    </Ctx.Provider>
  )
}

function apply(t: Theme) {
  const root = document.documentElement
  if (t === 'dark') root.setAttribute('data-theme', 'dark')
  else root.removeAttribute('data-theme')
}

// Inline script to avoid theme flash before React hydrates.
function NoFlashScript() {
  const code = `
    try {
      var k = '${STORAGE_KEY}';
      var t = localStorage.getItem(k);
      if (!t) { t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
      if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    } catch (e) {}
  `
  return <script dangerouslySetInnerHTML={{ __html: code }} suppressHydrationWarning />
}

export function useTheme() {
  const ctx = React.useContext(Ctx)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
