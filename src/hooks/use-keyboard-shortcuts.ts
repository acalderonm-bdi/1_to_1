'use client'

import { useEffect, useRef } from 'react'

interface ShortcutMap {
  [chord: string]: () => void
}

const CHORD_TIMEOUT_MS = 1200

function isEditableTarget(t: EventTarget | null) {
  if (!(t instanceof HTMLElement)) return false
  const tag = t.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (t.isContentEditable) return true
  return false
}

export function useKeyboardShortcuts(shortcuts: ShortcutMap, enabled = true) {
  const ref = useRef(shortcuts)
  ref.current = shortcuts

  useEffect(() => {
    if (!enabled) return
    let chordPrefix: string | null = null
    let chordTimer: ReturnType<typeof setTimeout> | null = null

    function clearChord() {
      chordPrefix = null
      if (chordTimer) { clearTimeout(chordTimer); chordTimer = null }
    }

    function handler(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isEditableTarget(e.target)) return
      const k = e.key.toLowerCase()
      if (k.length !== 1 && k !== 'escape') return
      if (k === 'escape') { clearChord(); return }

      if (chordPrefix) {
        const combo = `${chordPrefix} ${k}`
        const fn = ref.current[combo]
        clearChord()
        if (fn) {
          e.preventDefault()
          fn()
        }
        return
      }

      const direct = ref.current[k]
      if (direct) {
        e.preventDefault()
        direct()
        return
      }

      if (Object.keys(ref.current).some(combo => combo.startsWith(`${k} `))) {
        chordPrefix = k
        chordTimer = setTimeout(clearChord, CHORD_TIMEOUT_MS)
      }
    }

    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      clearChord()
    }
  }, [enabled])
}
