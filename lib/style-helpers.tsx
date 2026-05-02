// Shared design-token style helpers. The codebase doesn't use a CSS-in-JS
// framework — components inline their styles via the `style={{ ... }}`
// prop. That's deliberate (no runtime cost, no build pipeline), but it
// means recurring patterns get duplicated literally instead of referenced.
//
// This module captures the patterns that recur >=5 times across the
// components/ tree as exported constants + tiny components, so future
// changes happen in one place. Audit (2026-05-01) found:
//   - 149+ inline blobs of the "label style" pattern
//   - 20+ modal backdrop reimplementations
//   - 5+ close-× button reimplementations
//   - z-indexes scattered as magic numbers (10001, 10100, 2000, …)
//   - 1,386 inline borderRadius values
//
// Use these helpers for new code. Existing call sites are migrated
// opportunistically — full sweep is too big for one PR.

import type { CSSProperties, ReactNode } from 'react'

// ── Spacing scale ─────────────────────────────────────────────────────
// Pulled from observed inline values. Use string-literal types so
// consumers get autocomplete without preventing one-off `'7px'` overrides.
export const SPACING = {
  xs: '4px',
  sm: '6px',
  md: '10px',
  lg: '16px',
  xl: '20px',
} as const

// ── Border radius scale ───────────────────────────────────────────────
export const RADIUS = {
  sm: '2px',
  md: '3px',
  lg: '4px',
  xl: '6px',
} as const

// ── Z-index hierarchy ─────────────────────────────────────────────────
// Maps the observed magic numbers to semantic layers. New code should
// always pick a Z layer rather than inventing a new number — drift here
// is how stacking-context bugs are born.
//
//  1000  in-page floats (dropdowns, chip menus, drag affordances)
//  2000  in-page modal (settings, edit forms; sits above the page)
//  3000  in-page modal that opens from inside another modal
//  9999  app chrome (fixed nav, notification toasts)
// 10000  critical modal (loot, edit token, trade — cannot be backgrounded)
// 10100  helper that sits ON TOP of a critical modal (item picker etc.)
export const Z_INDEX = {
  dropdown: 1000,
  modal: 2000,
  modalNested: 3000,
  appChrome: 9999,
  criticalModal: 10000,
  criticalModalOver: 10100,
} as const

// ── Label style ───────────────────────────────────────────────────────
// The recurring "small uppercase Carlito caption" pattern that appears
// above form fields, list section headers, etc. Two sizes — 13px (the
// AGENTS.md minimum) and 14px (form labels that want to read a touch
// heavier). Both share the same shape; only fontSize differs.
//
// Both pair with `color: '#cce0f5'` (NOT `#3a3a3a` — that combo is
// banned per AGENTS.md and flagged by scripts/check-font-sizes.mjs).
//
// Two letterSpacing values appear in the codebase: '.06em' (the
// default variants below) and '.08em' (the "_TIGHT" variants).
// Both are visually subtle but distinguishable side-by-side, so we
// keep them separate to preserve the existing look of each file
// rather than pixel-shifting on an in-place refactor. New code
// should default to the .06em variants for consistency.
const LABEL_BASE: CSSProperties = {
  color: '#cce0f5',
  fontFamily: 'Carlito, sans-serif',
  textTransform: 'uppercase',
}

export const LABEL_STYLE: CSSProperties = {
  ...LABEL_BASE,
  fontSize: '13px',
  letterSpacing: '.06em',
}

export const LABEL_STYLE_LG: CSSProperties = {
  ...LABEL_BASE,
  fontSize: '14px',
  letterSpacing: '.06em',
}

export const LABEL_STYLE_TIGHT: CSSProperties = {
  ...LABEL_BASE,
  fontSize: '13px',
  letterSpacing: '.08em',
}

export const LABEL_STYLE_LG_TIGHT: CSSProperties = {
  ...LABEL_BASE,
  fontSize: '14px',
  letterSpacing: '.08em',
}

// ── ModalBackdrop ─────────────────────────────────────────────────────
// `position: fixed; inset: 0; background: rgba(0,0,0, X); flex-center`
// shows up ~20 times across components — extracting it here. Click on
// the backdrop fires `onClose` (most modals already follow this idiom);
// click on children does NOT propagate, so the modal body stays open.

export interface ModalBackdropProps {
  onClose?: () => void
  /** Pick from Z_INDEX. Defaults to `criticalModal`. */
  zIndex?: number
  /** Backdrop opacity. Defaults to 0.85, the most common value. */
  opacity?: number
  /** Outer flex padding (matters when the modal body is wider than the
   *  viewport on small screens). Defaults to `0` (no padding) so existing
   *  call sites that supply their own modal-body width keep behaving the
   *  same. Pass `'1rem'` or `SPACING.xl` if your modal needs to stay
   *  off the viewport edges. */
  padding?: CSSProperties['padding']
  children: ReactNode
}

export function ModalBackdrop({
  onClose, zIndex = Z_INDEX.criticalModal, opacity = 0.85, padding = 0, children,
}: ModalBackdropProps) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: `rgba(0,0,0,${opacity})`,
        zIndex,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ display: 'contents' }}>
        {children}
      </div>
    </div>
  )
}

// ── CloseButton ───────────────────────────────────────────────────────
// The × close button used in modal headers. Default to a muted grey that
// reddens on hover (the existing idiom across the codebase). Pass
// `tone="danger"` when the button should be red by default (e.g. the
// inventory delete-row × that's not a modal close).

export interface CloseButtonProps {
  onClick: () => void
  /** Tooltip — modals usually want "Close", row removers want "Remove" etc. */
  title?: string
  /** Default 'muted' (grey, reddens on hover). 'danger' (red always)
   *  matches the inventory row-remove style. */
  tone?: 'muted' | 'danger'
  /** Override the rendered glyph. Defaults to `×`. */
  children?: ReactNode
}

export function CloseButton({ onClick, title = 'Close', tone = 'muted', children = '×' }: CloseButtonProps) {
  const baseColor = tone === 'danger' ? '#f5a89a' : '#5a5550'
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'none',
        border: 'none',
        color: baseColor,
        fontSize: '13px',
        cursor: 'pointer',
        padding: '0 4px',
        lineHeight: 1,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = '#f5a89a')}
      onMouseLeave={(e) => (e.currentTarget.style.color = baseColor)}
    >
      {children}
    </button>
  )
}
