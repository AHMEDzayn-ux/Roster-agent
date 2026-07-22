import { useCallback, useEffect, useState } from 'react'

export type ThemePref = 'light' | 'dark' | 'system'
const STORAGE_KEY = 'callroster_theme'

function systemIsDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function getStoredPref(): ThemePref {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system'
}

export function effectiveTheme(pref: ThemePref): 'light' | 'dark' {
  return pref === 'system' ? (systemIsDark() ? 'dark' : 'light') : pref
}

function apply(pref: ThemePref) {
  document.documentElement.setAttribute('data-theme', effectiveTheme(pref))
}

/** Reactive theme state persisted to localStorage; keeps <html data-theme> in sync. */
export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(getStoredPref)

  useEffect(() => {
    apply(pref)
    localStorage.setItem(STORAGE_KEY, pref)
  }, [pref])

  // When following the system, react to OS theme changes live.
  useEffect(() => {
    if (pref !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => apply('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [pref])

  const resolved = effectiveTheme(pref)
  const toggle = useCallback(() => setPref(effectiveTheme(getStoredPref()) === 'dark' ? 'light' : 'dark'), [])

  return { pref, resolved, setPref, toggle }
}
