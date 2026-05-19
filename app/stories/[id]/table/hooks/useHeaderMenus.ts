// useHeaderMenus — owns the header-bar nested-dropdown state shared by
// the Checks / Community / GM Tools triggers in the live-session view.
// Extracted from page.tsx as Phase 3.0 step 2 of the decomposition
// (tasks/page-tsx-decomposition-plan.md).
//
// Behavior preserved verbatim:
//   - Only one menu opens at a time.
//   - Hover opens (when not pinned); mouse-leave closes (when not pinned).
//   - Clicking the trigger toggles a "pinned" state — stays open even
//     when the mouse wanders away, until clicked again, clicked outside,
//     or ESC. Pinning fixes the "I'm chasing the buttons" jitter where
//     moving toward a child accidentally crossed a dead zone.
//   - Outside-click anywhere not inside a [data-header-menu] container
//     closes whatever's open. Same for ESC.
//
// The hook returns the state pair + setters. Consumers (the
// renderHeaderMenu IIFE in page.tsx) call setters directly; future
// extractions of <TableHeaderMenu> as a sub-component can take the
// values via props or via a context derived from this hook.

import { useEffect, useState } from 'react'

export interface UseHeaderMenus {
  openHeaderMenu: string | null
  setOpenHeaderMenu: React.Dispatch<React.SetStateAction<string | null>>
  isMenuPinned: boolean
  setIsMenuPinned: React.Dispatch<React.SetStateAction<boolean>>
}

export function useHeaderMenus(): UseHeaderMenus {
  const [openHeaderMenu, setOpenHeaderMenu] = useState<string | null>(null)
  const [isMenuPinned, setIsMenuPinned] = useState(false)

  // Close any open header-bar dropdown on outside click or ESC. The
  // click target is checked against `[data-header-menu]` containers;
  // anything outside that closes the menu. Effect only attaches while
  // a menu is open — when nothing is open, no listeners are wasted.
  useEffect(() => {
    if (!openHeaderMenu) return
    function handleClick(e: MouseEvent) {
      const t = e.target as HTMLElement | null
      if (!t) return
      if (!t.closest('[data-header-menu]')) {
        setOpenHeaderMenu(null)
        setIsMenuPinned(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpenHeaderMenu(null)
        setIsMenuPinned(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [openHeaderMenu])

  return { openHeaderMenu, setOpenHeaderMenu, isMenuPinned, setIsMenuPinned }
}
