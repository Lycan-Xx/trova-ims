'use client'

import * as React from 'react'

const DEVTOOLS_SHORTCUT = 'F12'

export function DevToolsShortcut() {
  React.useEffect(() => {
    function isTauriEnv(): boolean {
      return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
    }

    async function handleKeyDown(event: KeyboardEvent) {
      if (!isTauriEnv()) return
      if (!event.ctrlKey || !event.shiftKey || event.key !== DEVTOOLS_SHORTCUT) return

      event.preventDefault()
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('open_main_devtools')
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return null
}
