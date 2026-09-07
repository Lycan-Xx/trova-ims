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

    // Let ordinary browser navigation handle unsupported schemes. The
    // `opener:default` capability permission only allows http(s)/mailto/tel,
    // which keeps arbitrary shell commands out of the desktop path.
    if (!/^(https?:|mailto:)/i.test(href)) return

    event.preventDefault()
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener')
      await openUrl(href)
    } catch (error) {
      console.error('[ExternalLink] Could not open default browser:', error)
    }
  }

  return <a href={href} target={target} rel={rel} onClick={handleClick} {...props} />
}
