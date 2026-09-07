'use client'

/**
 * PrinterSetup — desktop-only printer configuration UI.
 *
 * Renders null on web (non-Tauri) environments.
 * Allows the user to scan for USB printers, enter a TCP address,
 * and choose a paper width.
 */

import * as React from 'react'
import { Loader2, Usb, Wifi, CheckCircle2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  getPrinterSettings,
  savePrinterSettings,
  clearPrinterSettings,
  isPrinterConfigured,
  type PrinterSettings,
} from '@/lib/printer-settings'
import type { PrinterInfo } from '@/lib/hooks/use-printer-status'

type Tab = 'usb' | 'tcp'

export function PrinterSetup() {
  const [isTauri, setIsTauri] = React.useState(false)
  const [settings, setSettings] = React.useState<PrinterSettings | null>(null)
  const [tab, setTab] = React.useState<Tab>('usb')

  // USB state
  const [scanning, setScanning] = React.useState(false)
  const [foundPrinters, setFoundPrinters] = React.useState<PrinterInfo[]>([])
  const [selectedUsb, setSelectedUsb] = React.useState<string | null>(null)

  // TCP state
  const [tcpAddress, setTcpAddress] = React.useState('')
  const [tcpPort, setTcpPort] = React.useState(9100)
  const [testing, setTesting] = React.useState(false)

  // Paper width
  const [paperWidth, setPaperWidth] = React.useState<58 | 80>(80)

  React.useEffect(() => {
    const tauri =
      typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
    setIsTauri(tauri)
    if (tauri) {
      const s = getPrinterSettings()
      setSettings(s)
      setPaperWidth(s.paperWidth)
      if (s.type === 'usb' && s.usbPrinterName) {
        setTab('usb')
        setSelectedUsb(s.usbPrinterName)
      } else if (s.type === 'tcp') {
        setTab('tcp')
        setTcpAddress(s.tcpAddress ?? '')
        setTcpPort(s.tcpPort)
      }
    }
  }, [])

  if (!isTauri) return null

  // ── USB tab handlers ────────────────────────────────────────────────

  async function handleScanPrinters() {
    setScanning(true)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const result = await invoke<PrinterInfo[]>(
        'plugin:thermal-printer|list_thermal_printers',
      )
      setFoundPrinters(Array.isArray(result) ? result : [])
      if (!result || result.length === 0) {
        toast.info('No printers found. Make sure the printer driver is installed.')
      }
    } catch (err) {
      toast.error('Could not scan for printers.')
      console.error('[PrinterSetup] scan error:', err)
    } finally {
      setScanning(false)
    }
  }

  function handleSelectUsb(name: string) {
    setSelectedUsb(name)
    savePrinterSettings({ type: 'usb', usbPrinterName: name, paperWidth })
    setSettings(getPrinterSettings())
    toast.success(`Printer "${name}" saved.`)
  }

  // ── TCP tab handlers ────────────────────────────────────────────────

  async function handleTestTcp() {
    if (!tcpAddress.trim()) {
      toast.error('Enter an IP address first.')
      return
    }
    setTesting(true)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('plugin:thermal-printer|test_thermal_printer', {
        printerName: `TCP:${tcpAddress.trim()}:${tcpPort}`,
      })
      toast.success('Test page sent successfully.')
    } catch (err) {
      toast.error('Printer test failed — check address and connection.')
      console.error('[PrinterSetup] tcp test error:', err)
    } finally {
      setTesting(false)
    }
  }

  function handleSaveTcp() {
    if (!tcpAddress.trim()) {
      toast.error('Enter an IP address.')
      return
    }
    savePrinterSettings({
      type: 'tcp',
      tcpAddress: tcpAddress.trim(),
      tcpPort,
      paperWidth,
    })
    setSettings(getPrinterSettings())
    toast.success('Network printer saved.')
  }

  // ── Paper width handler ─────────────────────────────────────────────

  function handlePaperWidth(w: 58 | 80) {
    setPaperWidth(w)
    setSettings((current) => current ? { ...current, paperWidth: w } : current)
    savePrinterSettings({ paperWidth: w })
  }

  // ── Remove printer ─────────────────────────────────────────────────

  function handleClear() {
    clearPrinterSettings()
    setSettings(getPrinterSettings())
    setSelectedUsb(null)
    setFoundPrinters([])
    setTcpAddress('')
    setTcpPort(9100)
    toast.info('Printer removed.')
  }

  const configured = settings ? isPrinterConfigured(settings) : false

  // ── Styles ─────────────────────────────────────────────────────────
  const tabStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 16px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    border: 'none',
    cursor: 'pointer',
    transition: 'background 150ms, color 150ms',
    background: active ? 'var(--accent-primary)' : 'transparent',
    color: active ? '#fff' : 'var(--text-secondary)',
  })

  return (
    <div className="flex flex-col gap-5">
      {/* Current printer badge */}
      {configured && settings && (
        <div
          className="flex items-center justify-between rounded-lg px-4 py-3 text-sm"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}
        >
          <span style={{ color: 'var(--text-secondary)' }}>
            Current printer:{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {settings.type === 'usb'
                ? settings.usbPrinterName
                : `${settings.tcpAddress}:${settings.tcpPort}`}
            </strong>{' '}
            <span style={{ color: 'var(--text-muted)' }}>
              ({settings.paperWidth}mm paper)
            </span>
          </span>
          <button
            type="button"
            onClick={handleClear}
            title="Remove printer"
            className="flex items-center gap-1.5 text-xs transition-colors"
            style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <Trash2 size={13} />
            Remove
          </button>
        </div>
      )}

      {/* Tabs */}
      <div
        className="flex gap-1 p-1 rounded-lg w-fit"
        style={{ background: 'var(--bg-input)' }}
      >
        <button id="printer-tab-usb" type="button" style={tabStyle(tab === 'usb')} onClick={() => setTab('usb')}>
          <Usb size={14} />
          USB
        </button>
        <button id="printer-tab-tcp" type="button" style={tabStyle(tab === 'tcp')} onClick={() => setTab('tcp')}>
          <Wifi size={14} />
          Network (TCP)
        </button>
      </div>

      {/* USB panel */}
      {tab === 'usb' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Make sure the XPrinter driver is installed and the printer appears
            in Windows Printers &amp; Scanners before scanning.
          </p>

          <button
            id="printer-scan-btn"
            type="button"
            onClick={handleScanPrinters}
            disabled={scanning}
            className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium w-fit transition-colors disabled:opacity-60"
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              cursor: scanning ? 'not-allowed' : 'pointer',
            }}
          >
            {scanning ? (
              <Loader2 size={14} className="animate-spin" />
            ) : null}
            {scanning ? 'Scanning…' : 'Scan for printers'}
          </button>

          {foundPrinters.length > 0 && (
            <ul className="flex flex-col gap-2">
              {foundPrinters.map((p) => {
                const isSelected = selectedUsb === p.name
                return (
                  <li key={p.name}>
                    <button
                      type="button"
                      id={`printer-usb-${p.name.replace(/\s+/g, '-')}`}
                      onClick={() => handleSelectUsb(p.name)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm transition-colors text-left"
                      style={{
                        background: isSelected
                          ? 'var(--accent-primary-muted)'
                          : 'var(--bg-input)',
                        border: isSelected
                          ? '1px solid var(--accent-primary)'
                          : '1px solid var(--border)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                      }}
                    >
                      <span>{p.name}</span>
                      {isSelected && (
                        <CheckCircle2
                          size={16}
                          style={{ color: 'var(--accent-primary)', flexShrink: 0 }}
                        />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {foundPrinters.length === 0 && !scanning && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              No printers found yet. Click &quot;Scan for printers&quot; above.
            </p>
          )}
        </div>
      )}

      {/* TCP panel */}
      {tab === 'tcp' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Enter the IP address of your network-connected thermal printer. The
            default port is 9100.
          </p>

          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="printer-tcp-ip"
                className="text-xs font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                IP Address
              </label>
              <input
                id="printer-tcp-ip"
                type="text"
                placeholder="192.168.1.100"
                value={tcpAddress}
                onChange={(e) => setTcpAddress(e.target.value)}
                className="h-9 px-3 rounded-lg text-sm"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  width: 180,
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="printer-tcp-port"
                className="text-xs font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Port
              </label>
              <input
                id="printer-tcp-port"
                type="number"
                min={1}
                max={65535}
                value={tcpPort}
                onChange={(e) =>
                  setTcpPort(parseInt(e.target.value, 10) || 9100)
                }
                className="h-9 px-3 rounded-lg text-sm"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  width: 90,
                }}
              />
            </div>

            <button
              id="printer-tcp-test-btn"
              type="button"
              onClick={handleTestTcp}
              disabled={testing}
              className="h-9 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                cursor: testing ? 'not-allowed' : 'pointer',
              }}
            >
              {testing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                'Test'
              )}
            </button>

            <button
              id="printer-tcp-save-btn"
              type="button"
              onClick={handleSaveTcp}
              className="h-9 px-4 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: 'var(--accent-primary)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Paper width — shared across both tabs */}
      <div className="flex flex-col gap-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          Paper width
        </span>
        <div className="flex gap-3">
          {([80, 58] as const).map((w) => (
            <label
              key={w}
              className="flex items-center gap-2 cursor-pointer text-sm"
              style={{ color: 'var(--text-primary)' }}
            >
              <input
                id={`printer-paper-${w}`}
                type="radio"
                name="paperWidth"
                value={w}
                checked={paperWidth === w}
                onChange={() => handlePaperWidth(w)}
                style={{ accentColor: 'var(--accent-primary)' }}
              />
              {w}mm {w === 80 ? '(standard)' : '(narrow)'}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
