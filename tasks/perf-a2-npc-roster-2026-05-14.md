# Perf A2 - NpcRoster memo fix (2026-05-14)

## Step 1: memo() wrap
Already present - `NpcRosterImpl` is wrapped at **NpcRoster.tsx line 2235**:
```ts
const NpcRoster = memo(NpcRosterImpl)
export default NpcRoster
```
No change required.

## Step 2: Props memoized at call site (page.tsx ~line 3316)

| Prop | Pattern | Dep array |
|---|---|---|
| `npcRosterInitiativeNpcIds` | `new Set(filter + map)` | `[initiativeOrder]` |
| `npcRosterInitiativeNpcOrder` | rotation (`findIndex`, `slice`) + `filter` + `map` | `[initiativeOrder]` |
| `npcRosterPcEntries` | `.map(e => ({...}))` | `[entries]` |
| `npcRosterViewingNpcIds` | `new Set(.map)` | `[viewingNpcs]` |
| `onNpcRosterViewNpc` | `useCallback` wrapping `openPopout(...)` | `[id, gmLike]` |
| `onNpcRosterEditStarted` | `useCallback(() => setPendingEditNpcId(null))` | `[]` (setter is stable) |

The IIFE's local `initiativeNpcOrder` computation (previously lines 8046-8050) was removed; the JSX now uses `npcRosterInitiativeNpcOrder`.

## Props left inline - cascade risk

| Prop | Reason deferred |
|---|---|
| `onAddToCombat` | `addNpcsToCombat` is a plain `async function` with many closure deps |
| `onPlaceOnMap` | conditional expression; depends on unstable `placeTokenOnMap` |
| `onRemoveFromMap` | depends on unstable `removeTokenFromMap` |
| `onPlaceFolderOnMap` | depends on unstable `placeFolderOnMap` + inline `.map` |
| `onUnmapFolder` | depends on unstable `unmapFolderFromMap` |
| `onTacticalRefresh` | depends on unstable `refreshMapTokenIds` + `initChannelRef` |
| `onNpcDeleted` | depends on `loadInitiative`, multiple setters, `initChannelRef` |

Stabilising any of these requires converting the underlying plain functions to `useCallback` first - out of scope for this pass.

## Upstream handlers
`addNpcsToCombat`, `placeTokenOnMap`, `removeTokenFromMap`, `placeFolderOnMap`, `unmapFolderFromMap`, `refreshMapTokenIds` are plain `async function` declarations (NOT `useCallback`). Left as-is.

## Smoke-test plan
1. Open a campaign as GM, tab to NPCs - add or delete an NPC and confirm the roster card appears/disappears immediately without a page reload.
2. Start combat, advance the turn - confirm the gold initiative ring moves to the correct NPC in the roster without the entire roster blinking or losing scroll position.
