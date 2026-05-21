# Spec: `character_states` Preserve (Y11-a)

Spec for the hunt-and-peck lane. Ruling logged in `tasks/decisions.md` 2026-05-20: when a character is deleted, preserve `character_states` (soft-delete) so a revive flow can resurrect from last-known state, instead of hard cascade-deleting it.

**Lane:** hunt-and-peck executes. This spec is the contract.

**Status:** SPEC 2026-05-20. No code yet.

---

## 1. Current state

Character deletion is a hard delete at three call sites:
- `components/CharacterCard.tsx:297` - `supabase.from('characters').delete().eq('id', c.id)` (owner deletes own character)
- `app/characters/page.tsx:48` - same (characters list page)
- `app/moderate/users/[userId]/characters/page.tsx:59` + `:70` - Thriver moderation delete (single + bulk)

`character_states` rows are pulled with the character via FK CASCADE. (Evidence: `supabase/functions/delete-user/index.ts:120` explicitly deletes `character_states` by `character_id` before deleting `characters` - confirming the relationship exists and is cascade-cleaned.)

**Net today:** delete a character -> the `character_states` row (HP / RP / WP / position / stress / lasting wounds / death countdown / etc.) is gone forever. No revive path.

---

## 2. Target state

A character delete becomes a **soft-delete of both** `characters` and `character_states` via an `archived_at` timestamp. A revive flow flips both back to active. Hard-delete remains available to the `delete-user` edge function (GDPR erasure must still hard-delete).

Decision recorded: PRESERVE. Revive flow can resurrect.

---

## 3. Schema changes

```sql
-- sql/character-states-preserve-2026-05-DD.sql (idempotent)
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.character_states
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Partial indexes so the active-row queries stay fast.
CREATE INDEX IF NOT EXISTS idx_characters_active
  ON public.characters (user_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_character_states_active
  ON public.character_states (character_id) WHERE archived_at IS NULL;
```

**FK cascade:** leave the existing `character_states.character_id -> characters.id ON DELETE CASCADE` FK in place. Soft-delete doesn't trigger it (no row is deleted). The cascade only fires on a TRUE delete (the GDPR erasure path), which is correct.

---

## 4. Code changes

### 4a. Soft-delete on the three character-delete call sites

Replace `.delete().eq('id', c.id)` with an archive update + cascade the archive to character_states:

```ts
// shared helper - lib/character-archive.ts (new)
export async function archiveCharacter(supabase, characterId: string) {
  const now = new Date().toISOString()
  await Promise.all([
    supabase.from('characters').update({ archived_at: now }).eq('id', characterId),
    supabase.from('character_states').update({ archived_at: now }).eq('character_id', characterId),
  ])
}
```

Wire `archiveCharacter` into:
- `components/CharacterCard.tsx:293` `handleDelete`
- `app/characters/page.tsx:43` delete handler
- `app/moderate/users/[userId]/characters/page.tsx:59` single + `:70` bulk (bulk = `.eq('user_id', userId)` -> archive all the user's characters)

### 4b. Filter active reads

Every `from('characters')` / `from('character_states')` SELECT that should show only active characters needs `.is('archived_at', null)`. Audit the read sites:
- `app/characters/page.tsx` (character list)
- `lib/hooks` / table page `loadEntries` (`character_states + characters` join at the table page)
- `app/moderate/users/[userId]/characters/page.tsx`
- Anywhere else `from('characters')` is read for display.

**Gotcha:** the table page's `loadEntries` joins `character_states + characters + campaign_members`. Add the `archived_at IS NULL` filter there so archived characters drop out of the in-session roster.

### 4c. Revive flow (new UI)

A Thriver (or the owner, TBD) sees archived characters in a "Deleted characters (recoverable)" section. A "Revive" button calls:

```ts
export async function reviveCharacter(supabase, characterId: string) {
  await Promise.all([
    supabase.from('characters').update({ archived_at: null }).eq('id', characterId),
    supabase.from('character_states').update({ archived_at: null }).eq('character_id', characterId),
  ])
}
```

Where the revive UI lives: recommend `app/characters/page.tsx` (a collapsed "Recently deleted" section) for the owner + `app/moderate/users/[userId]/characters/page.tsx` for Thrivers. Scope to Xero's preference.

### 4d. RLS

The existing RLS policies on `characters` + `character_states` continue to apply. Archived rows are still owned by the same user, so the owner can still read/revive them. No RLS change needed unless you want archived rows hidden from non-owner reads (they already are, by ownership scoping).

---

## 5. Migration phases

### CSP-A1: schema (0.5 session)
Apply the SQL from Section 3. Verify columns + indexes exist via `information_schema`. No behavior change yet (nothing writes `archived_at`).

### CSP-A2: soft-delete writes (1 session)
Add `lib/character-archive.ts`. Wire `archiveCharacter` into the 3 delete sites. **Don't filter reads yet** - archived characters still show, but they now carry `archived_at`. Verify: delete a test character, confirm `archived_at` is set on both rows (SQL check), confirm the character still appears (reads not filtered yet).

### CSP-A3: filter reads (1 session)
Add `.is('archived_at', null)` to every active-read site. Verify: the archived character now disappears from the list + the in-session roster.

**Gate:** full character lifecycle - create, use in a session, delete, confirm it vanishes from roster + list.

### CSP-A4: revive UI (1 session)
Add the "Recently deleted" section + Revive button. Verify: revive an archived character, confirm it reappears with its last-known state (HP, stress, wounds) intact.

### CSP-A5: backfill (decision, see Section 6)

---

## 6. Backfill plan

Existing characters that were hard-deleted before this ships are GONE - can't recover them. Backfill only affects rows that exist NOW:
- All current `characters` + `character_states` rows have `archived_at = NULL` (the column default). They're all active. No backfill needed for active rows.
- There's nothing to un-delete (hard-deleted rows left no trace).

**So: no backfill required.** The migration is forward-only. Document that pre-2026-05-DD deletions are unrecoverable.

---

## 7. Risks

### CA-R1: missed read site leaves archived characters visible
If a `from('characters')` SELECT doesn't get the `archived_at IS NULL` filter, deleted characters reappear somewhere. **Mitigation:** grep every `from('characters')` + `from('character_states')` read in CSP-A3; checklist each.

### CA-R2: in-session roster shows ghost characters
The table page `loadEntries` join is the highest-traffic read. If the filter is missed there, a deleted PC shows in the initiative roster mid-session. **Mitigation:** explicit smoke test in CSP-A3 gate.

### CA-R3: GDPR erasure must still hard-delete
The `delete-user` edge function MUST keep hard-deleting (archived rows still contain PII). Do NOT change `supabase/functions/delete-user/index.ts` to soft-delete. **Mitigation:** leave the edge function alone; it's the one path that truly removes data.

### CA-R4: duplicate-name collision on revive
If a user deleted "Marcus" then created a new "Marcus", reviving the old one yields two "Marcus" characters. **Mitigation:** acceptable (they have different ids); OR warn on revive if an active character shares the name.

---

## 8. Smoke test matrix

| Step | Test |
|---|---|
| Schema | Columns + indexes exist; existing rows have `archived_at = NULL`. |
| Soft-delete | Delete a character -> both rows get `archived_at`; FK not triggered. |
| Read filter | Deleted character gone from list + in-session roster. |
| Revive | Revived character reappears with HP/stress/wounds intact. |
| GDPR | `delete-user` still hard-deletes (archived rows included). |
| Moderation bulk | Thriver "delete all" archives all the user's characters. |

---

## 9. Maintenance

Update the soft-delete-stance doc (`tasks/ops-soft-delete-stance-2026-05-19.md`) to move `characters` + `character_states` into the "soft-delete" section once this ships. Update the Risk Register if the character lifecycle becomes a load-bearing concern.
