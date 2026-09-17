// Layout for the /v2 frame pages.
//
// Its only job is to load frame.css for this subtree. Keeping the frame's
// stylesheet here rather than in app/globals.css is what lets Phase 0 promise
// the OLD pages are unchanged: they never parse it.
//
// No chrome is added here. components/Frame.tsx draws the title bar, section
// strip and rails, and each /v2 page composes it, because the section strip's
// active tab and the rail contents differ per page.
//
// The old sidebar is already skipped for these paths by
// lib/auth/public-pages.ts isV2Path, consumed in components/LayoutShell.tsx.
import './frame.css'

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
