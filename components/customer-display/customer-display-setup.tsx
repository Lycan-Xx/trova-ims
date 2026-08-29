'use client'

import * as React from 'react'
import { Monitor, ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  getCustomerDisplaySettings,
  saveCustomerDisplaySettings,
} from '@/lib/customer-display'

interface MonitorInfo {
  index: number
  label: string
}

export function CustomerDisplaySetup() {
  const [settings, setSettings] = React.useState(getCustomerDisplaySettings)
  const [monitors, setMonitors] = React.useState<MonitorInfo[]>([])
  const [opening, setOpening] = React.useState(false)
  const [supported, setSupported] = React.useState(false)

  React.useEffect(() => {
    let active = true
    async function loadMonitors() {
      if (!('__TAURI_INTERNALS__' in window)) return
      try {
        const { availableMonitors } = await import('@tauri-apps/api/window')
        const found = await availableMonitors()
        if (!active) return
        setSupported(true)
        setMonitors(found.map((monitor, index) => ({
          index,
          label: index === 0 ? 'Primary display' : `Display ${index + 1}`,
        })))
      } catch {
        if (active) setSupported(false)
      }
    }
    void loadMonitors()
    return () => { active = false }
  }, [])

  async function openDisplay() {
    setOpening(true)
    try {
      const { availableMonitors, PhysicalPosition, PhysicalSize } = await import('@tauri-apps/api/window')
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
      const found = await availableMonitors()
      const monitor = found[settings.monitorIndex] ?? found[0]
      if (!monitor || found.length < 2) {
        toast.error('Connect a second display before opening Customer Display.')
        return
      }

      saveCustomerDisplaySettings({ enabled: true, monitorIndex: found.indexOf(monitor) })
      setSettings(getCustomerDisplaySettings())

      const existing = await WebviewWindow.getByLabel('customer-display')
      if (existing) {
        await existing.setFocus()
        return
      }

      const customerWindow = new WebviewWindow('customer-display', {
        title: 'Trova IMS Customer Display',
        url: `${window.location.origin}/customer-display`,
        decorations: false,
        resizable: false,
      })
      await new Promise<void>((resolve, reject) => {
        customerWindow.once('tauri://created', () => resolve())
        customerWindow.once('tauri://error', () => reject(new Error('Customer Display window could not be created.')))
      })
      try {
        await customerWindow.setPosition(new PhysicalPosition(monitor.position.x, monitor.position.y))
        await customerWindow.setSize(new PhysicalSize(monitor.size.width, monitor.size.height))
        await customerWindow.setFocus()
      } catch {
        toast.warning('Customer Display opened, but could not be positioned on the selected monitor.')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not open Customer Display.')
    } finally {
      setOpening(false)
    }
  }

  function selectMonitor(index: number) {
    const next = saveCustomerDisplaySettings({ monitorIndex: index })
    setSettings(next)
  }

  return (
    <section
      className="rounded-xl p-6"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Customer Display
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Open a customer-safe order view on a second monitor when needed.
          </p>
        </div>
        <Monitor size={18} style={{ color: 'var(--text-muted)' }} />
      </div>

      <div className="mt-5 flex flex-col gap-4">
        <label className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-primary)' }}>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(event) => setSettings(saveCustomerDisplaySettings({ enabled: event.target.checked }))}
          />
          Remember Customer Display preference
        </label>

        <label className="flex flex-col gap-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Display
          <select
            value={settings.monitorIndex}
            onChange={(event) => selectMonitor(Number(event.target.value))}
            disabled={monitors.length === 0}
            className="h-9 rounded-md px-2 text-sm"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            {monitors.length === 0 ? <option value={settings.monitorIndex}>No displays detected</option> : null}
            {monitors.map((monitor) => <option key={monitor.index} value={monitor.index}>{monitor.label}</option>)}
          </select>
        </label>

        <button
          type="button"
          onClick={() => void openDisplay()}
          disabled={opening || !supported || monitors.length < 2}
          className="inline-flex items-center justify-center gap-2 h-9 rounded-md px-3 text-sm font-medium w-fit"
          style={{ background: 'var(--accent-primary)', color: '#fff', opacity: opening || !supported || monitors.length < 2 ? 0.55 : 1 }}
          title={monitors.length < 2 ? 'Connect a second display first' : 'Open customer display'}
        >
          {opening ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
          Open Customer Display
        </button>
        {!supported ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Customer Display is available in the desktop app.</p>
        ) : monitors.length < 2 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>A second monitor is required.</p>
        ) : null}
      </div>
    </section>
  )
}
