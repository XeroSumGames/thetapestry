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

// (Was: LABEL_STYLE_LG_TIGHT — 14px + .08em variant. Created defensively
// during the initial label sweep but the codebase had no 14px+.08em call
// sites to map onto, so it sat unused. Removed 2026-05-03; restore from
// git history if a real call site shows up later.)

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

// ── Button ────────────────────────────────────────────────────────────
// The 438+ inline action-button styles across the codebase mostly fall
// into the same handful of tone+size combos. Extracting one component
// with a tone/size prop pair lets new code adopt cleanly without
// inventing yet another color palette per call site.
//
// Tones (background / color / border are picked together — these aren't
// named after meaning, they're named after visual feel):
//   primary   — red, white text. Default CTA (Save, Submit, Apply Selected).
//   secondary — grey, neutral text. Default for Cancel / Close / passive.
//   confirm   — green. Apply, Yes, OK on a destructive prompt.
//   warning   — amber. Caution flows (overwrites, force, paid spend).
//   info      — blue. Informational / non-destructive next steps.
//   magic     — purple. Module / Apprentice / Schism / world-feature flows.
//   danger    — red text on dark red. Delete row, remove, destructive
//                undoable actions (NOT primary CTA — use 'primary' for that).
//
// Sizes shape padding + fontSize. Color/tone is independent of size.
//
// Variant: 'solid' (default) is the filled button. 'ghost' renders
// transparent bg + colored border + colored text using each tone's
// `chroma` (the most "characteristic" color of the tone). Most cancel
// / back / dismiss buttons in the codebase are `tone="info"
// variant="ghost"` (transparent + #7ab3d4 outline).
//
// `disabled` and `busy` both fall back to disabled+dimmed; `busy`
// additionally hints `cursor: wait` so async-submitting buttons read
// differently from invalid-form buttons. Pass `style` for one-offs
// (flex: 1, marginTop, custom width — the helper merges yours last).
//
// The helper deliberately doesn't bake in hover handlers — the
// codebase doesn't use JS hover effects for action buttons (color +
// cursor change is the affordance), and adding a baseline hover here
// would silently shift the look across every adopted site.

export type ButtonTone =
  | 'primary'
  | 'secondary'
  | 'confirm'
  | 'warning'
  | 'info'
  | 'magic'
  | 'danger'

export type ButtonSize = 'sm' | 'md' | 'lg'

export type ButtonVariant = 'solid' | 'ghost'

// `chroma` is the tone's signature color — used by the ghost variant
// for both border and text. Solid uses bg/color/border directly.
// Note that primary's chroma is its bg (red); for tones whose color
// IS the signature (info / confirm / magic / warning), chroma is the
// color attribute. Danger's chroma matches its border (#c0392b).
const BUTTON_TONES: Record<ButtonTone, { bg: string; color: string; border: string; chroma: string }> = {
  primary:   { bg: '#c0392b', color: '#ffffff', border: '#c0392b', chroma: '#c0392b' },
  secondary: { bg: '#242424', color: '#d4cfc9', border: '#3a3a3a', chroma: '#d4cfc9' },
  confirm:   { bg: '#1a2e10', color: '#7fc458', border: '#2d5a1b', chroma: '#7fc458' },
  warning:   { bg: '#2a2010', color: '#EF9F27', border: '#5a4a1b', chroma: '#EF9F27' },
  info:      { bg: '#0f1a2e', color: '#7ab3d4', border: '#1a3a5c', chroma: '#7ab3d4' },
  magic:     { bg: '#2a102a', color: '#d48bd4', border: '#5a2e5a', chroma: '#d48bd4' },
  danger:    { bg: '#2a1210', color: '#f5a89a', border: '#c0392b', chroma: '#c0392b' },
}

const BUTTON_SIZES: Record<ButtonSize, CSSProperties> = {
  sm: { padding: '4px 10px', fontSize: '13px' },
  md: { padding: '8px 12px', fontSize: '13px' },
  lg: { padding: '10px 18px', fontSize: '14px' },
}

export interface ButtonProps {
  tone?: ButtonTone
  size?: ButtonSize
  /** 'solid' (default) = filled. 'ghost' = transparent + colored
   *  outline using each tone's chroma. Cancel / Back / dismiss
   *  buttons in this codebase are typically `tone="info"
   *  variant="ghost"`. */
  variant?: ButtonVariant
  disabled?: boolean
  /** Like disabled but also hints `cursor: wait` so an async-pending
   *  button reads differently from a constraint-blocked one. */
  busy?: boolean
  type?: 'button' | 'submit' | 'reset'
  title?: string
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  /** One-off overrides (flex: 1, custom width, marginTop, etc.). Merged
   *  last so caller wins. */
  style?: CSSProperties
  children: ReactNode
}

export function Button({
  tone = 'secondary',
  size = 'md',
  variant = 'solid',
  disabled,
  busy,
  type = 'button',
  title,
  onClick,
  style,
  children,
}: ButtonProps) {
  const t = BUTTON_TONES[tone]
  const s = BUTTON_SIZES[size]
  const inactive = disabled || busy
  const palette = variant === 'ghost'
    ? { bg: 'transparent', color: t.chroma, border: t.chroma }
    : { bg: t.bg, color: t.color, border: t.border }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={inactive}
      title={title}
      style={{
        ...s,
        background: palette.bg,
        color: palette.color,
        border: `1px solid ${palette.border}`,
        borderRadius: '3px',
        fontFamily: 'Carlito, sans-serif',
        letterSpacing: '.06em',
        textTransform: 'uppercase',
        fontWeight: 600,
        cursor: busy ? 'wait' : inactive ? 'not-allowed' : 'pointer',
        opacity: inactive ? 0.5 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  )
}
