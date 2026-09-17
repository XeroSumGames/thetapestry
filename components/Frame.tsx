/**
 * The house VTT frame: two rails and a centre panel.
 *
 * THIS IS A STANDARD, not a choice this app made. Every Xero Sum Games VTT uses
 * it - D:\Coding\VTTs\TheTable\tasks\vtt-frame-standard.md, decided by Xero
 * 2026-09-12. COPIED from the Mothership VTT reference implementation
 * (D:\Coding\VTTs\mothership-vtt\components\Frame.tsx), whose geometry came
 * from TheTableau's TerminalFrame. The instruction is explicit: copy a
 * reference, do not re-derive the frame.
 *
 * Note the reference's own warning that TheTapestry was NOT the reference - its
 * global shell is two-pane and its three-pane table is bespoke to one route.
 * This file is the house frame arriving in Tapestry, at /v2, alongside the old
 * layout rather than replacing it (tasks/plan-one-frame-new-pages-2026-09-15.md).
 *
 * WHAT BELONGS WHERE. Getting a control into the wrong rail is the easy
 * mistake, so the rule is a question: does the GAME own this, or the PLAYER?
 *
 *   left    the game frame   - navigating the game, and the logs
 *   centre  multi-use        - character sheet, map, whatever is in use now
 *   right   the player panel - their notes, their inventory
 *
 * The component is deliberately dumb: three slots, no opinion about contents.
 * Layout lives in .frame / .fcol in app/v2/frame.css, which is imported by
 * app/v2/layout.tsx only - the old pages parse none of it.
 */

export interface NavTab {
  id: string
  label: string
}

export default function Frame({
  titleBar,
  nav,
  navActive,
  onNav,
  left,
  centre,
  right,
}: {
  /** The full-width chrome ABOVE the panes. The grid sizes itself against
      this, so the panes fill exactly what is left. */
  titleBar?: React.ReactNode
  /** The section strip under the title bar. The FIRST tab sits over the left
      rail at its width (280px), the LAST over the right rail (260px), and the
      rest share what is between - so the strip lines up with the columns
      beneath it. VTT standard 2026-09-14; the widths live in .navtab CSS. */
  nav?: NavTab[]
  navActive?: string
  onNav?: (id: string) => void
  left: React.ReactNode
  centre: React.ReactNode
  /** Omit to fall back to a two-column grid - a page with genuinely no
      player-side content should not render an empty rail. */
  right?: React.ReactNode
}) {
  return (
    // v2frame carries the token mapping; frameroot carries the geometry.
    <div className="v2frame frameroot">
      {titleBar ? <div className="titlebar">{titleBar}</div> : null}
      {nav && nav.length > 0 ? (
        <div className={`navstrip${right ? '' : ' navstrip--noright'}`} role="tablist">
          {nav.map(t => (
            <button
              key={t.id}
              role="tab"
              className="navtab"
              aria-selected={t.id === navActive}
              onClick={() => onNav?.(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className={`frame${right ? '' : ' frame--noright'}`}>
        <aside className="fcol fcol-left">{left}</aside>
        <main className="fcol fcol-centre">{centre}</main>
        {right ? <aside className="fcol fcol-right">{right}</aside> : null}
      </div>
    </div>
  )
}

/**
 * A rail's tab strip. The house device for multiplexing a fixed-width column -
 * both TheTapestry's table and TheTableau do it, and reaching for one is the
 * answer before widening a rail.
 */
export function RailTabs({
  tabs,
  active,
  onPick,
}: {
  tabs: { id: string; label: string; disabled?: boolean }[]
  active: string
  onPick: (id: string) => void
}) {
  return (
    <div className="railtabs" role="tablist">
      {tabs.map(t => (
        <button
          key={t.id}
          role="tab"
          className="railtab"
          aria-selected={t.id === active}
          disabled={t.disabled}
          title={t.disabled ? 'Not built yet' : undefined}
          onClick={() => !t.disabled && onPick(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
