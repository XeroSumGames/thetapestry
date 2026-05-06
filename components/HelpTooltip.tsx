'use client'
import { useEffect, useRef, useState } from 'react'

// HelpTooltip — small ⓘ icon that reveals an explanation card on
// hover (desktop) or tap (mobile). Built lightweight on purpose: no
// external library, no portal, no animation framework. Positions
// itself above or below the trigger based on available viewport
// space so it never gets clipped at screen edges.
//
// Used throughout character creation to explain RAPID attributes,
// skills, weapon traits, CDP / CMod / AMod / SMod, vocational
// skills, etc. Content lives in lib/help-text.ts (or any string the
// caller passes in directly).

interface Props {
  /** The text shown inside the popover. Plain string for now;
   *  callers pass through lib/help-text constants or short authored
   *  copy. */
  text: string
  /** Optional bold heading shown above the text — useful for
   *  "RSN — Reason" style headers above the description. */
  title?: string
  /** Override the trigger glyph. Default ⓘ; some surfaces want a
   *  question-mark or a small "?" pill instead. */
  icon?: React.ReactNode
  /** Optional CSS overrides for the icon. */
  iconStyle?: React.CSSProperties
  /** When true, the popover anchors to the icon's right edge instead
   *  of centred — useful when the icon sits at the right of a row. */
  anchorRight?: boolean
}

export default function HelpTooltip({ text, title, icon, iconStyle, anchorRight }: Props) {
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState<'above' | 'below'>('below')
  const wrapRef = useRef<HTMLSpanElement>(null)

  // Smart placement — flip to 'above' when there's more space above
  // the trigger than below it. Recomputes on open so the user gets
  // the right placement even after scrolling.
  useEffect(() => {
    if (!open || !wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    setPlacement(spaceBelow < 160 && spaceAbove > spaceBelow ? 'above' : 'below')
  }, [open])

  // Tap-outside closes the popover on touch devices where mouseleave
  // doesn't fire reliably.
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <span
      ref={wrapRef}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={title ? `Help: ${title}` : 'Help'}
        onClick={e => { e.stopPropagation(); e.preventDefault(); setOpen(o => !o) }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '15px',
          height: '15px',
          padding: 0,
          marginLeft: '4px',
          background: 'transparent',
          border: '1px solid #5a5550',
          borderRadius: '50%',
          color: '#9aa5b0',
          fontSize: '13px',
          fontWeight: 700,
          fontFamily: 'Carlito, sans-serif',
          cursor: 'help',
          lineHeight: 1,
          ...iconStyle,
        }}
      >
        {icon ?? 'ⓘ'}
      </button>
      {open && (
        <span
          style={{
            position: 'absolute',
            zIndex: 1000,
            ...(placement === 'below'
              ? { top: 'calc(100% + 6px)' }
              : { bottom: 'calc(100% + 6px)' }),
            ...(anchorRight ? { right: 0 } : { left: 0 }),
            minWidth: '220px',
            maxWidth: '320px',
            padding: '10px 12px',
            background: '#0f0f0f',
            border: '1px solid #5a5550',
            borderRadius: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
            color: '#f5f2ee',
            fontSize: '13px',
            fontFamily: 'Carlito, sans-serif',
            lineHeight: 1.5,
            textAlign: 'left',
            cursor: 'default',
            whiteSpace: 'pre-line',
          }}
          // Stop propagation so the click handler on the button
          // doesn't toggle the popover when the user is reading it.
          onClick={e => e.stopPropagation()}
        >
          {title && (
            <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '13px', fontWeight: 700, color: '#cce0f5', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>
              {title}
            </div>
          )}
          {text}
        </span>
      )}
    </span>
  )
}
