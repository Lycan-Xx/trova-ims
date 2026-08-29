'use client'

import * as React from 'react'

type ExternalLinkProps = Omit<React.ComponentPropsWithoutRef<'a'>, 'href'> & {
  href: string
}

function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function ExternalLink({ href, onClick, target = '_blank', rel = 'noopener noreferrer', ...props }: ExternalLinkProps) {
  async function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)
    if (event.defaultPrevented || !isTauriEnvironment()) return

    // Let ordinary browser navigation handle unsupported schemes. The native
    // command accepts only the URL schemes that are expected for support/legal
    // links, which keeps arbitrary shell commands out of the desktop path.
    if (!/^(https?:|mailto:)/i.test(href)) return

    event.preventDefault()
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('open_external_url', { url: href })
    } catch (error) {
      console.error('[ExternalLink] Could not open default browser:', error)
    }
  }

  return <a href={href} target={target} rel={rel} onClick={handleClick} {...props} />
}
