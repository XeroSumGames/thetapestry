# Finding - Party Status shows stale PCs (previous character assignments)

**Lane:** routed to **Hunt & Peck**.
**Reporter:** Xero 2026-06-12 via screenshot of `/campaign-sheet` Party
Status panel showing 6 PCs including "Wren Brand" - a character whose
player has since assigned a different character to the campaign. Stale
PC should not appear; current PC should.

## What Xero said (verbatim)

> "the PARTY STATUS is wrong. this includes previous characters. the
>  ONLY player characters in this list should be the ones that the
>  current players have ASSIGNED to this. if there is a player absent
>  (assume Marv logged out) then they would still show in this list,
>  but (say) Wren Brand who was a previous character would not, as the
>  player behind it assigned a different character to the campaign."

## The canon rule

Party Status panel = the characters CURRENTLY assigned to this
campaign by the players who own them. Source-of-truth for "who is
playing what" is `campaign_members.character_id` for each
`(campaign_id, user_id)` row.

Logged-out vs. reassigned:
- **Logged out** (Marv): player is offline but their assignment row
  in `campaign_members` is unchanged -> their PC SHOULD render.
- **Reassigned** (Wren Brand's owner switched to a different
  character): player's `campaign_members.character_id` now points at
  the new PC. The old PC SHOULD NOT render. The new PC SHOULD render.

## Root cause

[app/campaign-sheet/page.tsx:96-101](app/campaign-sheet/page.tsx:96)
loads the party from `character_states`:

```ts
const { data: states } = await supabase
  .from('character_states')
  .select('id, character_id, wp_current, wp_max, rp_current, rp_max, stress')
  .eq('campaign_id', campaignId)
```

`character_states` rows persist for every character that was EVER
active in the campaign (live-stats history). When a player reassigns,
their old PC's `character_states` row stays in place. The Party Status
panel pulls every such row, so the old PC keeps showing.

The fix is to filter to only those `character_id`s that are CURRENTLY
in `campaign_members` for this campaign.

## Fix shape

### Option A: extra round-trip (smallest change)

```ts
const { data: members } = await supabase
  .from('campaign_members')
  .select('character_id')
  .eq('campaign_id', campaignId)
const currentCharIds = (members ?? [])
  .map((m: any) => m.character_id)
  .filter(Boolean)
if (currentCharIds.length === 0) { setParty([]); return }

const { data: states } = await supabase
  .from('character_states')
  .select('id, character_id, wp_current, wp_max, rp_current, rp_max, stress')
  .eq('campaign_id', campaignId)
  .in('character_id', currentCharIds)
```

One extra `campaign_members` query, then `.in('character_id', ...)`
filter on the existing `character_states` query. Backwards-compatible
shape; no schema change.

### Option B: PostgREST inner join (one round-trip)

```ts
const { data: states } = await supabase
  .from('character_states')
  .select('id, character_id, wp_current, wp_max, rp_current, rp_max, stress, campaign_members!inner(character_id)')
  .eq('campaign_id', campaignId)
  .eq('campaign_members.campaign_id', campaignId)
```

Cleaner but PostgREST relationship-filter syntax is finicky; verify
the FK relationship between `character_states.character_id` and
`campaign_members.character_id` is discoverable (may need a manual
`!inner` relationship hint or a fallback to Option A if the FK isn't
defined).

**Recommend Option A** for the smallest blast radius; the extra round
trip is negligible against a 6-row party.

## Parallel surface to verify

Same query pattern at
[app/stories/[id]/table/page.tsx:933](app/stories/[id]/table/page.tsx:933):

```ts
supabase.from('character_states').select('*').eq('campaign_id', campaignId),
```

This is `liveStates` for the table page. If stale PCs flow through
here, they'll appear on the table page's roster / character cards too.
Spot-check the table page against a campaign with known reassignments.
If stale PCs render anywhere on `/stories/[id]/table`, apply the same
`campaign_members` filter there too. Same shape, same fix.

Other character_states queries at lines 1249 (kicked-flag check),
1635 (specific-char-id filter), and `lib/campaign-snapshot.ts:54`
(snapshot serializer) all filter further by character_id or are
explicitly meant to cover ALL history (snapshot), so they're NOT
affected by this bug.

## Acceptance

- A player who has reassigned their character in a campaign sees ONLY
  their CURRENT PC in the Party Status panel.
- A logged-out player's currently-assigned PC STILL renders.
- A player who has NEVER reassigned sees their single PC unchanged.
- Same behavior verified on `/stories/[id]/table` (the table page's
  liveState-driven surfaces).
- Build + 873 unit tests + font/role/em-dash/arch all green.

## Tracking

Add to todo.md CURRENT OPEN:

```
- [ ] **[ROUTED -> HUNT & PECK 2026-06-12][HIGH] Party Status shows stale PCs (previous character assignments)** - `/campaign-sheet` Party Status panel renders every `character_states` row for the campaign instead of only the CURRENTLY assigned characters per `campaign_members`. Fix: filter `character_states` query at `app/campaign-sheet/page.tsx:96-101` to `.in('character_id', currentCharIds)` where `currentCharIds` comes from `campaign_members` filtered by campaign_id. Spot-check + apply same fix at `app/stories/[id]/table/page.tsx:933` if liveStates surface stale PCs there too. Finding: `tasks/finding-party-status-stale-pcs-2026-06-12.md`. **Trigger:** 2026-06-12 Xero screenshot showed 6 PCs in Party Status, including "Wren Brand" whose owning player has since reassigned to a different character.
```
