# Role Helper Consolidation — 2026-05-14

## Summary

Eliminated 30+ inline `.role?.toLowerCase() === 'thriver'` / `.role === 'thriver'`
drift sites across the codebase. All now route through `isThriver()` (aliased as
`roleIsThriver` where a local `isThriver` state variable exists) from
`lib/auth/roles.ts`. The guardrail script was also extended to catch this drift
pattern going forward.

---

## Files Changed

### app/ page routes (commit: `refactor(app)`)

| File | Line(s) | Old pattern | Replacement |
|------|---------|-------------|-------------|
| `app/characters/page.tsx` | 28 | `profile?.role?.toLowerCase() === 'thriver'` | `roleIsThriver(profile)` |
| `app/characters/[id]/edit/page.tsx` | 54 | `(prof as any)?.role?.toLowerCase() === 'thriver'` | `roleIsThriver(prof)` |
| `app/characters/[id]/page.tsx` | 26 | `profile?.role?.toLowerCase() === 'thriver'` | `roleIsThriver(profile)` |
| `app/stories/[id]/edit/page.tsx` | 53 | `(profile?.role as string)?.toLowerCase() === 'thriver'` | `setIsThriver(roleIsThriver(profile))` |
| `app/stories/[id]/table/page.tsx` | 1248 | `(myProfile?.role ?? '').toLowerCase() === 'thriver'` | `roleIsThriver(myProfile)` |
| `app/campfire/war-stories/page.tsx` | 122 | `profile && (profile.role as string)?.toLowerCase() === 'thriver'` | `roleIsThriver(profile)` |
| `app/campfire/lfg/page.tsx` | 124 | `profile && (profile.role as string)?.toLowerCase() === 'thriver'` | `roleIsThriver(profile)` |
| `app/campfire/forums/page.tsx` | 118 | `profile && (profile.role as string)?.toLowerCase() === 'thriver'` | `roleIsThriver(profile)` |
| `app/campfire/forums/[id]/page.tsx` | 77 | `profile && (profile.role as string)?.toLowerCase() === 'thriver'` | `roleIsThriver(profile)` |
| `app/character-sheet/page.tsx` | 44 | `(profRes.data as any).role?.toLowerCase() === 'thriver'` | `roleIsThriver(profRes.data)` |
| `app/rumors/page.tsx` | 63-64 | `const role = (data?.role ?? '').toLowerCase(); if (role === 'thriver')` | `setIsThriver(roleIsThriver(data))` |
| `app/rumors/[id]/edit/page.tsx` | 130 | `((profile?.role ?? '') as string).toLowerCase() === 'thriver'` | `roleIsThriver(profile)` |
| `app/record/page.tsx` | 67 | `((prof as any)?.role ?? '').toLowerCase() === 'thriver'` | `roleIsThriver(prof)` |
| `app/record/page.tsx` | 270 | `p.role && p.role.toLowerCase() === 'thriver'` | `roleIsThriver(p)` |
| `app/dashboard/page.tsx` | 52 | `profile.role === 'thriver'` | `roleIsThriver(profile)` |
| `app/gm-notes-popout/page.tsx` | 97 | `(profile as any)?.role?.toLowerCase() === 'thriver'` | `roleIsThriver(profile)` |

### app/tools/ pages (commit: `refactor(tools)`)

| File | Line | Old pattern | Replacement |
|------|------|-------------|-------------|
| `app/tools/reseed-campaign/page.tsx` | 47 | `(profile?.role ?? '').toString().toLowerCase() === 'thriver'` | `roleIsThriver(profile)` |
| `app/tools/migrate-settings-to-modules/page.tsx` | 120 | `((data?.role ?? '') as string).toLowerCase() === 'thriver'` | `roleIsThriver(data)` |
| `app/tools/migrate-character-photos/page.tsx` | 71 | `(profile?.role ?? '').toString().toLowerCase() === 'thriver'` | `roleIsThriver(profile)` |
| `app/tools/import-gm-kit/page.tsx` | 38 | `(profile?.role ?? '').toString().toLowerCase() === 'thriver'` | `roleIsThriver(profile)` |
| `app/tools/portrait-resizer/page.tsx` | 80 | `(profile?.role ?? '').toString().toLowerCase() === 'thriver'` | `roleIsThriver(profile)` |
| `app/tools/campaign-explorer/page.tsx` | 76 | `(profile?.role ?? '').toString().toLowerCase() === 'thriver'` | `roleIsThriver(profile)` |

### app/moderate/ pages (commit: `refactor(moderate)`)

| File | Line(s) | Old pattern | Replacement |
|------|---------|-------------|-------------|
| `app/moderate/page.tsx` | 172 | `((prof as any)?.role ?? '').toLowerCase() === 'thriver'` | `roleIsThriver(prof)` |
| `app/moderate/page.tsx` | 180 | `typeof myRole === 'string' && myRole.toLowerCase() === 'thriver'` | `roleIsThriver(myRole)` |
| `app/moderate/page.tsx` | 909 | `u.role?.toLowerCase() === 'thriver'` (inline style) | `roleIsThriver(u)` |
| `app/moderate/page.tsx` | 944-946 | `u.role?.toLowerCase() === 'thriver'` ×3 (inline styles) | `roleIsThriver(u)` |
| `app/moderate/users/[userId]/activity/page.tsx` | 228-230 | `header.role?.toLowerCase() === 'thriver'` ×3 | `roleIsThriver(header)` |

### components/ (commit: `refactor(components)`)

| File | Line(s) | Old pattern | Replacement |
|------|---------|-------------|-------------|
| `components/Sidebar.tsx` | 69 | `profile.role === 'thriver'` | `roleIsThriver(profile)` |
| `components/Sidebar.tsx` | 79 | `profile.role === 'thriver'` | `roleIsThriver(profile)` |
| `components/Sidebar.tsx` | 136, 138, 144, 169, 242 | `userRole === 'thriver'` (5 sites) | `roleIsThriver(userRole)` |
| `components/MapView.tsx` | 642 | `typeof p.role === 'string' && p.role.toLowerCase() === 'thriver'` | `roleIsThriver(p)` |
| `components/MapView.tsx` | 961, 1313, 1408, 1718, 1720, 1963 | `userRole === 'thriver'` / local const | `roleIsThriver(userRole)` |
| `components/QuickAddModal.tsx` | 239 | `userRole === 'thriver'` (local const) | `roleIsThriver(userRole)` |
| `components/QuickAddModal.tsx` | 514 | `userRole === 'thriver'` (JSX) | `roleIsThriver(userRole)` |

### Guardrail (commit: `chore(guardrails)`)

`scripts/check-role-literals.mjs` — extended with two new regex patterns:
- **Pattern 2**: `.role?.toLowerCase()` or `.role.toLowerCase()` followed by `==`/`===` comparison to a role string
- **Pattern 3**: `.role === 'thriver'` / `.role == 'survivor'` / `.role === 'ghost'` (profile role values only; requires `==` or `===` to avoid matching SQL `=` in comments)

Added `lib/community-logic.ts` to `SKIP_PATHS` — that file uses `.role` for community labor roles (`gatherer`/`maintainer`/`safety`/`assigned`/`unassigned`), not profile roles.

---

## Sites Intentionally Left Alone

| File | Line(s) | Reason |
|------|---------|--------|
| `app/logging/page.tsx` | ~183 | `'Ghost'`/`'Survivor'` are Leaflet popup display strings, not comparisons. Already in original `SKIP_PATHS`. |
| `app/stories/[id]/community/page.tsx` | 143-146 | `m.role === 'gatherer'` etc. — community labor roles, not profile roles |
| `components/CampaignCommunity.tsx` | multiple | `m.role === 'assigned'`, `m.role === 'gatherer'` etc. — labor roles |
| `lib/community-logic.ts` | 79-142 | Labor pool role comparisons (gatherer/maintainer/safety/unassigned) |
| `lib/style-helpers.tsx` | 293 | `variant === 'ghost'` — a UI variant string, not a profile role |
| `components/Sidebar.tsx` | 68 | `(profile.role as string).toLowerCase()` to set state — normalization assignment, not comparison |
| `app/dashboard/page.tsx` | 51 | `(profile.role as string).toLowerCase()` to set state — same |

## Import Alias Convention

All files that already have a local `isThriver` variable (state or const) import the helper as:
```ts
import { isThriver as roleIsThriver } from '...'
```
Files where no local `isThriver` exists could import directly, but we used the alias consistently for clarity.

`app/moderate/page.tsx` already had this convention (`isThriver as roleIsThriver`) — the remaining three inline patterns in that file were just missed in the original migration.
