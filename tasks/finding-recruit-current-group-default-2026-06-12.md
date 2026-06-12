# Finding - Recruit COMMUNITY dropdown should default to "Current group" at the top

**Lane:** routed to **Hunt & Peck**.
**Reporter:** Xero 2026-06-12 screenshot of the Recruitment "Pick
target & approach" modal on the table page.

## What Xero said

> "for RECRUITMENT. if there is no community, it is assumed all the
>  players are in a group together, the first drop down option should
>  be CURRENT GROUP"

Translation: the implicit "party you're playing as right now" is a
first-class concept; the dropdown should reflect that by surfacing
"Current group" as the FIRST option (and the default), not buried at
the bottom as "+ Start a new group."

## Where (verified)

[app/stories/[id]/table/page.tsx:9811-9835](app/stories/[id]/table/page.tsx:9811)
renders the Community dropdown inside the Recruitment modal:

```tsx
{hasAnyCommunity ? (
  <select value={recruitCommunityId} onChange={...}>
    <option value="">- pick a community -</option>
    {recruitCommunityList.map(c => (
      <option key={c.id} value={c.id}>{c.name} ({c.member_count} member{c.member_count === 1 ? '' : 's'})</option>
    ))}
    <option value="__new__">+ Start a new group</option>
  </select>
) : (
  // No communities yet - auto-set to __new__ and show inline
  ...
)}
```

Today's behavior:
- Default is `""` ("- pick a community -" placeholder).
- Existing communities listed in the middle.
- "+ Start a new group" (the `__new__` option) at the BOTTOM.
- When NO communities exist, auto-defaults to `__new__` (good
  behavior; matches Xero's intent for that case).

Xero's complaint applies to the `hasAnyCommunity` branch: even when
there are existing communities, the "current group" concept (mapped
to `__new__` today) should be the default + first.

## Fix shape

Restructure the dropdown so that "Current group" sits at the top + is
the default selection. Three changes:

1. **Move `__new__` to the top of the option list**:
   ```tsx
   <select value={recruitCommunityId || '__new__'} onChange={...}>
     <option value="__new__">Current group</option>
     {recruitCommunityList.length > 0 && (
       <optgroup label="Existing communities">
         {recruitCommunityList.map(c => (
           <option key={c.id} value={c.id}>{c.name} ({c.member_count} member{c.member_count === 1 ? '' : 's'})</option>
         ))}
       </optgroup>
     )}
   </select>
   ```

2. **Change the default state**: `recruitCommunityId` initial state
   should be `'__new__'`, not `''`. Search for the `useState<string>('')`
   at `page.tsx:580` and flip the default. (Or leave it `''` and use
   the `||` fallback on the select's value, but the cleaner version
   is to set the underlying state correctly.)

3. **Drop the "- pick a community -" placeholder**. With "Current
   group" as a first-class default, there's no need for a "pick one"
   prompt. The `hasAnyCommunity ? : :` branching can also be
   simplified (the no-community case is now just "Current group
   shows; user clicks Roll").

4. **Rename anywhere the user sees "Start a new group" text** -
   inline labels at `:9826` and `:9832` use "starts a new group" /
   "Group name (optional)" phrasing. Update to match "Current group"
   semantics. The Group-name input can stay as-is - it's only
   relevant on the FIRST recruit into the current group, naming it
   forever after.

## Acceptance

- The dropdown's first option reads "Current group" (or "Current
  Group" - copy your call).
- "Current group" is selected by default when the Recruit modal
  opens.
- Existing communities still appear, grouped under "Existing
  communities" (or similar) below the default.
- Picking "Current group" + Roll behaves exactly like picking the
  former "+ Start a new group" option does today (same submit path
  + same backing community-creation logic).
- The `!hasAnyCommunity` inline path (`:9824-9828`) stays equivalent
  - it can either be kept as-is or unified with the new pattern
  since the new default delivers the same UX.
- Build + 873 unit tests + font/role/em-dash/arch all green.

## Bonus issue surfaced in the same screenshot

The dropdown shows entries:
- `[E2E] Resub New 1779652890634 (0 members)`
- `[E2E] Resub New 1779661487119 (0 members)`

These are leftover communities from E2E test runs that didn't clean
up properly. Verified in live DB: 3 `[E2E]`-prefixed community rows
exist that should not be visible to players.

Two ways to handle this:

**Option A: Filter `[E2E]`-prefixed communities out of player-facing
dropdowns** (this finding's lane - HP). Defensive but masks the
underlying test-data leak.

**Option B: E2E lane cleans up its own test data after each run**.
Right fix but doesn't address the 3 already-orphaned rows + relies
on E2E never failing mid-test.

Recommend BOTH: HP adds an `[E2E]` name-prefix filter as a defensive
layer (1-line `.filter(c => !c.name.startsWith('[E2E]'))` on
recruitCommunityList); E2E lane gets a routed finding to clean up
the existing 3 rows + audit the E2E community-create specs for
missing cleanup. The filter is the quick win; the E2E cleanup is
the proper fix.

Live DB cleanup query (Puffer-or-Xero-applied, NOT in HP's commit):

```sql
DELETE FROM communities
WHERE name LIKE '[E2E]%' OR name LIKE 'E2E%' OR name LIKE '%Resub New%';
```

(Cascades to community_members and any related rows per the existing
FK setup. Confirm cascade chain before running.)

## Tracking

Append to todo.md PLAYTEST POLISH ROUTES:

```
- [ ] **[ROUTED -> HUNT & PECK 2026-06-12] Recruit modal COMMUNITY dropdown should default to "Current group" at the top** - `app/stories/[id]/table/page.tsx:9811-9835` defaults to "- pick a community -" with `__new__` at the bottom labeled "+ Start a new group." Xero says: implicit party = "current group" + should be first + default. Fix: move `__new__` to top, rename to "Current group", default state at `:580` flips from '' to '__new__', existing communities grouped under "Existing communities" optgroup below. Bonus: filter `[E2E]`-prefixed communities defensively. Finding: `tasks/finding-recruit-current-group-default-2026-06-12.md`.
```
