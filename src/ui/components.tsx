import { type ReactNode, useEffect, useRef, useState } from 'react'
import { t } from './text'

type IconProps = { size?: number }
const svg = (path: ReactNode, size = 18) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {path}
  </svg>
)

export const Icon = {
  shield: ({ size }: IconProps) => svg(<><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></>, size),
  key: ({ size }: IconProps) => svg(<><circle cx="7.5" cy="15.5" r="4.5" /><path d="M10.7 12.3L20 3M16 7l3 3M14 9l2 2" /></>, size),
  folder: ({ size }: IconProps) => svg(<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />, size),
  upload: ({ size }: IconProps) => svg(<><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>, size),
  copy: ({ size }: IconProps) => svg(<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></>, size),
  check: ({ size }: IconProps) => svg(<path d="M5 12l5 5 9-10" />, size),
  eye: ({ size }: IconProps) => svg(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>, size),
  eyeOff: ({ size }: IconProps) => svg(<><path d="M3 3l18 18" /><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7c1.9 0 3.5-.6 4.9-1.4" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>, size),
  alert: ({ size }: IconProps) => svg(<><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v4M12 17.5v.5" /></>, size),
  github: ({ size }: IconProps) => svg(<path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />, size),
  x: ({ size }: IconProps) => svg(<path d="M6 6l12 12M18 6L6 18" />, size),
}

async function writeClipboard (text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch (err) {
    // fallback for contexts without the async clipboard API
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    el.remove()
  }
}

export function CopyButton ({ text, label, compact }: { text: string, label?: string, compact?: boolean }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number>()
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return (
    <button
      type="button"
      className={`btn btn-ghost${compact ? ' btn-compact' : ''}`}
      onClick={async () => {
        await writeClipboard(text)
        setCopied(true)
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? <Icon.check size={16} /> : <Icon.copy size={16} />}
      <span>{copied ? t.copied : (label ?? t.copy)}</span>
    </button>
  )
}

export function Segmented<T extends string> ({ value, options, onChange, label }: {
  value: T
  options: Array<{ value: T, label: string }>
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Notice ({ tone, children }: { tone: 'info' | 'warn' | 'error' | 'success', children: ReactNode }) {
  return (
    <div className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : undefined}>
      {tone === 'success' ? <Icon.check size={18} /> : tone === 'info' ? <Icon.shield size={18} /> : <Icon.alert size={18} />}
      <div>{children}</div>
    </div>
  )
}

export function Spinner () {
  return <span className="spinner" aria-hidden="true" />
}
