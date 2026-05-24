# FINDING: PC-to-PC item trade DESTROYS the item (RLS data-loss) - 2026-05-24

**Found by:** Playwright/E2E lane while building `inventory-trade.spec.ts` (#13).
**Severity:** HIGH - silent player-facing DATA LOSS on a core action, plus a
misleading "you received X" notification for an item that never arrived.
**Status:** CONFIRMED on live prod (empirical REST probe + code read). Routed to
Puffer Fish (RLS/RPC owner) + Hunt & Peck (the client handler). NOT an E2E fix.

## What happens

A Survivor giving an inventory item to ANOTHER player's PC loses the item; the
recipient never gets it. The give "succeeds" in the UI (no error, broadcast +
notification fire), so it is silent.

## Why (mechanism)

`confirmGive` (`components/InventoryPanel.tsx:156-181`) does TWO writes:

1. `onGiveTo(item, targetId, qty)` -> the table-page handler
   (`app/stories/[id]/table/page.tsx:6921-6942`) runs
   `supabase.from('characters').update({ data: {... inventory: +item} }).eq('id', targetCharId)`
   from the GIVER's session. The `characters` UPDATE RLS is own-row only
   (`"Users can update own characters"`, `USING (auth.uid() = user_id)`,
   schema.sql:2187) plus a Thriver bypass (`characters_thriver_bypass`,
   schema.sql:2189). A Survivor giver is neither the target's owner nor a
   Thriver, so the UPDATE matches 0 rows and is a SILENT no-op (PostgREST returns
   200 with `[]`, no error).
2. Lines 168-179 then decrement the SENDER via `onUpdate(...)`, which writes the
   giver's OWN `characters` row (RLS allows) -> SUCCEEDS.

Net: sender's item removed, receiver's item never added = **item destroyed**.
The `notify_inventory_received` RPC (SECURITY DEFINER, fires regardless,
table/page.tsx:6936) then tells the receiver they got an item they did not.

When the giver is the GM (a Thriver), the Thriver bypass lets write #1 succeed,
so GM-initiated gives work - which is likely why this slipped through (testing as
GM). Player-to-player is the broken, common case.

## Proof (empirical, reversible probe, 2026-05-24)

As `marv` (Survivor), PATCH `percy`'s character `data.inventory` to add a marker
item, read back as `percy`:
- `marv -> percy PATCH`: HTTP **200**, returned rows **`[]`** (RLS filtered).
- `percy` inventory: 4 items before, 4 after; marker **did not land**.
=> the giver genuinely cannot write the receiver's row. (Probe restored nothing
because nothing changed.)

Other targets use the same direct-write pattern and likely share the bug for
non-Thriver givers: `onGiveItemToNpc` (campaign_npcs), `onGiveItemToCommunity`,
`onGiveItemToVehicle` (table/page.tsx:6947+). Worth auditing all four against
their tables' UPDATE RLS - same class as this finding.

## Suggested fix (Puffer Fish owns; bright line - not applied by E2E)

A SECURITY DEFINER RPC that performs BOTH sides atomically off the real
`auth.uid()`, mirroring the existing patterns:
- `sql/loot-npc-item-rpc.sql` (PC loots an NPC item) and the vehicle
  `update_vehicle_in_campaign()` RPC already solve "write a row I don't own,
  scoped to a campaign I'm a member of."
- New `give_item_pc_to_pc(giver_char_id, receiver_char_id, item, qty)`:
  validate the caller owns `giver_char_id` AND both chars are members of the
  same campaign, then move the item (remove from giver, stack-add to receiver)
  in one transaction. Swap the two client writes in `confirmGive` /
  `onGiveItem` for the single RPC call.

## E2E follow-up (once the RPC lands)

`inventory-trade.spec.ts` ships now covering the WORKING half (add catalog item,
add custom item, encumbrance recompute, persistence on reload - all own-character,
reversible). The cross-PC trade assertion is included as a `test.fixme` pointing
at this finding; un-fixme it (marv gives -> percy's REST inventory gains the item
+ marv's loses it, both via the RPC) once the fix is live.
