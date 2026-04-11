# Test Plan — Unified `/dashboard` tab host

## What changed
- New `components/TerminalFrame.tsx` renders the fixed chrome: title bar + left panel (ACTIVE OPERATOR / OPERATOR STATUS / SYSTEM STATUS / QUICK ACCESS) + right panel (SECTOR MAP / THE TERMINAL / MY OPERATIONS). Center column is children.
- `components/TerminalTitleBar.tsx` tabs now all point at `/dashboard?tab=<name>`. Active tab is driven by a new `activeTab` prop (no more `useSearchParams` inside TitleBar).
- `app/dashboard/page.tsx` rewritten as the unified host. Reads `?tab=` and swaps center content:
  - `terminal` (default) → old dashboard center (ACTIVE OPERATION / roll log / comms log)
  - `starchart` → `DisplacedStarMap` filling the center column, with Travel Calculator overlay
  - `operations` / `roster` / `tools` → placeholder stubs
- Legacy `/terminal` and `/starmap` pages still exist and still render via direct URL, but no longer highlight a tab.

## Prerequisites
1. Open a terminal in `C:\theTableau`
2. Start the dev server (e.g. `powershell -File dev-server.ps1`)
3. Wait for "Ready on http://localhost:PORT"

## Golden path tests

### 1. Default tab loads Terminal content
- Navigate to `http://localhost:PORT/dashboard`
- **Expect:** URL stays `/dashboard`. Frame renders. Left panel shows ACTIVE OPERATOR card (Korr, Aanya) and OPERATOR STATUS stats. Right panel shows SECTOR MAP + THE TERMINAL feed. Center shows ALERT banner, ACTIVE OPERATION card, RECENT ROLLS, COMMS LOG. Top nav shows "TERMINAL" tab highlighted cyan.

### 2. Switch to Star Chart
- Click "STAR CHART" tab
- **Expect:** URL becomes `/dashboard?tab=starchart`. Left and right panels are **unchanged** (exact same frame). Center column now shows the interactive star map filling the center area with the Travel Calculator overlay in the top-left of the center column. "STAR CHART" tab is highlighted cyan. Status bar reads "STAR CHART — THE REACH // 29 SYSTEMS..."

### 3. Star Chart functionality inside the frame
- Click two stars on the map
- **Expect:** Travel Calculator picks up origin + destination, shows route, distances, and drive comparison (BK / Galileo MK1 / Galileo MK2). Route highlight renders on the map. "CLEAR ROUTE" resets.

### 4. Switch to Operations / Roster / Tools
- Click each tab
- **Expect:** URL updates to `?tab=operations`, `?tab=roster`, `?tab=tools`. Frame (left + right panels) is unchanged. Center shows placeholder "OPERATIONS // CONTENT PENDING" etc. Correct tab highlighted.

### 5. Switch back to Terminal
- Click "TERMINAL" tab
- **Expect:** URL becomes `/dashboard?tab=terminal`. Center returns to ACTIVE OPERATION content. No flicker in left/right panels.

## Edge cases

### 6. Deep link to Star Chart
- Paste `http://localhost:PORT/dashboard?tab=starchart` directly in browser
- **Expect:** Page loads straight to Star Chart tab with map + overlay.

### 7. Bogus tab value
- Navigate to `http://localhost:PORT/dashboard?tab=doesnotexist`
- **Expect:** Falls back to Terminal tab content (default case in switch). No crash.

### 8. Legacy routes still work
- Navigate to `http://localhost:PORT/terminal` → old `/terminal` page renders unchanged, no tab highlighted.
- Navigate to `http://localhost:PORT/starmap` → old full-screen star map page still renders.

### 9. Frame state persists across tab switches
- On Star Chart, click two stars to set a route.
- Switch to Terminal tab, then back to Star Chart.
- **Expect:** Route resets (StarChartTabContent unmounts on tab switch). This is **expected** — noting it in case we want to lift state later.

### 10. Browser back button
- Click Terminal → Star Chart → Operations → press browser Back twice
- **Expect:** Goes Operations → Star Chart → Terminal.

## Regression checks
- [ ] No console errors on any tab
- [ ] Title bar clock ticks every second on all tabs
- [ ] Scanline overlay still visible on all tabs
- [ ] Navigating to `/welcome` or other app pages still works (TerminalTitleBar refactor didn't break anything)
- [ ] `notepad C:\theTableau\app\terminal\page.tsx` — sanity-check it still compiles

## If something breaks
- Build-time `useSearchParams must be wrapped in Suspense` error → `DashboardHost` is already wrapped. If this fires for another component, check for stray `useSearchParams` calls.
- Star map too small / clipped → `DisplacedStarMap` uses 100% of its container via ResizeObserver; check the parent `<div style={{ position: 'absolute', inset: 0 }}>` in `StarChartTabContent`.
- Tabs highlight wrong → `activeTab` is passed from `DashboardHost` → `TerminalFrame` → `TerminalTitleBar`. Check the chain.
