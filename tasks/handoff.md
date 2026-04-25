# Session Handoff — 2026-04-24 (continued)

## TL;DR
- This session shipped **the entire Campfire flagship** (Messages realtime fix, LFG with Share + Interest + Invite, Forums, War Stories with attachments, OG metadata, one-stop-shop tabbed hub) plus a stack of pin-edit polish.
- **Tomorrow = Inventory.** Surprise: ~80% of inventory already exists and works. The real next step is filling gaps, not building from scratch. See § Inventory below.
- **9 SQL migrations** were shipped this session. You confirmed running 2 early (`messages-rls-fix`, `messages-actions`) but the rest may not have been run yet — see checklist.

---

## ⚠️ Pending Supabase migrations (run in order, all idempotent)

Each is a single paste-and-run in the Supabase SQL Editor. Skip any you've already run.

| Order | File | Purpose |
|------:|------|---------|
| 1 | `sql/messages-rls-fix.sql` | (confirmed run) DM visibility |
| 2 | `sql/messages-actions.sql` | (confirmed run) archive/block columns |
| 3 | `sql/pin-address.sql` | Add `address` column to `map_pins` (Edit Pin modal) |
| 4 | `sql/messages-realtime-publication.sql` | Adds `messages` + `conversation_participants` to `supabase_realtime` publication. **This was the fix for "messages don't show without refresh."** |
| 5 | `sql/lfg.sql` | LFG posts table + RLS |
| 6 | `sql/lfg-interests.sql` | LFG `lfg_interests` table + notification trigger |
| 7 | `sql/forums.sql` | `forum_threads` + `forum_replies` + triggers |
| 8 | `sql/war-stories.sql` | `war_stories` table + RLS |
| 9 | `sql/war-stories-attachments.sql` | `attachments` jsonb column + `war-stories` storage bucket + storage RLS |

After running, hard-refresh the live site (Ctrl-Shift-R) to clear stale schemas.

---

## What shipped this session

### Pin polish
- **Edit Pin modal: Lat / Lng + Address** (`components/MapView.tsx`) — Thrivers can move pins or attach a street address inline. Empty/invalid lat/lng skip on save (won't null existing coords).
- **Topo as default for new campaigns/adventures** (`app/campaigns/new/page.tsx` and `app/stories/new/page.tsx`).
- **Pin popup: created_at line removed** — was clutter.

### Messaging realtime fix
- `sql/messages-realtime-publication.sql` — root cause for "had to refresh to see new messages." Both tables now in the `supabase_realtime` publication; sets `REPLICA IDENTITY FULL` on `conversation_participants` so the bell's UPDATE filter matches.

### Send Message deep-links (DM scaffolding)
- Campaign members list (`app/stories/[id]/page.tsx`): 💬 Message next to every other player's join date.
- Community PC rosters (`components/CampaignCommunity.tsx`): 💬 button next to role selector. NPC rows skip automatically.

### Campfire — built top-to-bottom
- **Looking for Group** (`/campfire/lfg`): bulletin board with two post kinds (GM seeking players / Player seeking game), filter chips, inline composer.
  - **🔗 Share popover**: Copy Link / Discord (copy) / Reddit / X / Facebook with deep-link hash anchors.
  - **Asymmetric "I'm Interested" flow** (replaces cold-DM): viewers express interest with a toggle; the post author sees a roster of interested users and only THEY see 💬 Message buttons. Notification fires for the author when someone presses Interested.
  - **🎟 Invite picker**: roster Message + Invite (sends DM with /join/<code> link to one of the GM's campaigns). Reuses existing `/join/<code>` route.
- **Forums** (`/campfire/forums` + `/campfire/forums/[id]`): categorized threads (Lore / Rules / Session Recaps / General) with replies, edit/delete, locked threads. Pinned threads float; rest sort by latest activity (trigger-maintained).
- **War Stories** (`/campfire/war-stories`): session highlight feed. Title + body + optional campaign tag (bronze chip). **Attachments**: images render as 240-px thumbnails (click → full-size new tab); non-images render as `📎 download` pills. Bucket: `war-stories`, public read, author-write.
- **Open Graph + Twitter Card metadata** on `/campfire`, `/campfire/lfg`, `/campfire/forums` so shared links render with title + description + Distemper logo on Discord/Reddit/X/FB.
- **One-stop-shop hub** (`/campfire`): replaces the old card grid with tabs (Messages / LFG / Forums / War Stories / Homebrew-soon). Active tab tracked in `?tab=…`. Each tab embeds the route component directly — standalone routes still work for deep-links.

### Misc
- Side note: someone (you?) added auto-linkify to DM messages between sessions (commit `e541fa5`). I rebased on top of it.

---

## Inventory state map (what already exists)

**The tldr**: Inventory is FAR more built than the memory file suggested. It's a working feature with end-to-end Supabase wiring, an SRD catalog of 33 items + every weapon, custom items, encumbrance tracking, and basic loot transfer. The "next major feature" is closer to "polish + add the missing 20%" than "build from scratch."

### What's wired and working

| Feature | Where | Status |
|---|---|---|
| Inventory button on character sheet | `components/CharacterCard.tsx:349` | ✅ Triggers `<InventoryPanel>` modal |
| InventoryPanel UI | `components/InventoryPanel.tsx` (276 lines) | ✅ Full modal with header, encumbrance bar, item list, catalog picker, custom-item form |
| `EquipmentItem` interface + 33 SRD items | `lib/xse-schema.ts:256–298` | ✅ {name, rarity, enc, notes} |
| `InventoryItem` with quantity + custom flag | `InventoryPanel.tsx:25–32` | ✅ {name, enc, rarity, notes, qty, custom} |
| Combined catalog (gear + weapons) | `InventoryPanel.tsx:16–22` | ✅ Weapons normalized into EquipmentItem shape |
| Catalog search/filter | `InventoryPanel.tsx:54, 116–119` | ✅ Filters name + notes |
| Custom-item creation | `InventoryPanel.tsx:84–92` | ✅ Name, enc, notes; rarity hard-coded Common |
| Encumbrance formula | `InventoryPanel.tsx:69`, `CharacterCard.tsx:727` | ⚠ Duplicated in two places (technical debt) |
| Encumbrance display + OVERLOADED flag | `InventoryPanel.tsx:131–146` | ✅ Shows weapons / gear / limit breakdown |
| Backpack +2 detection | `InventoryPanel.tsx:67–68` | ✅ Matches by name |
| Loot transfer (1-at-a-time give) | `InventoryPanel.tsx:107–114` + `app/stories/[id]/table/page.tsx:6198–6209` | ✅ End-to-end Supabase write to receiver, decrement giver |
| Realtime broadcast on transfer | `table/page.tsx:6208` | ✅ `inventory_transfer` channel event |
| `campaign_npcs.inventory` jsonb column | `sql/npc-inventory.sql` | ✅ NPCs CAN hold inventory at the schema level |
| Object loot (crate/barrel drops on destroy) | `table/page.tsx:3499+` | ✅ Auto-loot to attacker when object destroyed |
| Loot log narrative | `table/page.tsx:296+` | ✅ "🎒 X looted Y from Z" rows |

---

## Inventory gaps (the actual work)

Things that DON'T exist or are thin. Roughly ordered by player-facing value.

1. **NPC inventory UI** — `campaign_npcs.inventory` column exists but no GM-facing UI to populate it. Without this, "loot the dead NPC" can't work.
2. **Loot-from-NPC flow** — currently you can loot destroyed objects but not slain hostiles. Distemper is a survival game; this is a glaring gap. Would mirror the object-destroy auto-loot pattern: when an NPC dies, surface their inventory to attacking PCs to distribute.
3. **Quantity picker on Give** — currently transfers exactly 1 unit. "Give 5 ammo" requires clicking 5 times.
4. **Notification on receive** — receiver gets a realtime broadcast but no notification or visible UI cue. Easy to miss.
5. **Campaign-level custom item library** — custom items are per-character; can't reuse "Mongrels' Antitoxin" across the campaign's PCs. Would need a `campaign_items` table the GM authors and players pick from.
6. **Item categories beyond rarity** — no "medical / food / tool / ammo" tags. Hampers filtering once a character has 20+ items.
7. **Item charges / durability** — flashlights die, medkits run out. No tracking.
8. **Two-way trade** — only one-way Give. No "I'll give X for Y" flow.
9. **Item images** — text-only. Custom items could optionally carry an image (mirror war-stories attachments pattern).
10. **Trade journal / give-receive log entries** — log only fires for object-loot, not for PC-to-PC give. Hard to audit "who has the medkit?"
11. **GM-facing bulk drop** — "give all 4 PCs an extra clip" requires opening 4 sheets. Mentioned as low-priority in backlog.
12. **Encumbrance formula deduplication** — copy-pasted between `InventoryPanel.tsx:69` and `CharacterCard.tsx:727`. Should live in `lib/xse-schema.ts` or `lib/inventory.ts`.
13. **Death/Lasting Wound → Medical item interaction** — gameplay link from items to the wound system. Out of scope for v1 but worth noting.

---

## Recommended plan for tomorrow

### Step 0 — Verify (10 min, before any code)
Test the existing inventory flow live, with the migrations from this session run. Open a character sheet → click Inventory → add items from catalog → create a custom item → give an item to another PC. Confirm encumbrance updates. **If anything is broken**, that's where to start. Otherwise:

### Step 1 — Decide scope (chat with me; 5 min)
Pick from the gaps list. My recommended wedge for v1:
- **A. Loot-from-NPC** (biggest player-facing win, fits Distemper survival genre, NPC inventory schema already exists)
- **B. Quantity picker on Give + Notification on receive** (small, high-polish)
- **C. Encumbrance formula deduplication** (tech-debt; one shared `computeEncumbrance` helper)

A combo of A + B is a good day's work and ships meaningful value. C is a 30-min cleanup we can fold in or skip.

### Step 2 — Plan the chosen wedge in detail
For Loot-from-NPC specifically:
- **NPC inventory editor** — GM picks an NPC in `NpcRoster.tsx` → gets the same InventoryPanel scoped to that NPC (refactor InventoryPanel to take `holder: { kind: 'pc'|'npc', id, ... }` so it works for both).
- **Loot trigger** — when an NPC's WP hits 0 and they're hostile, surface a "🎒 Loot" affordance to PCs in range. Modal lets them distribute the items (per-PC qty pickers). Empty inventory → no affordance.
- **Realtime + log** — broadcast to all players, write a `loot` outcome row to `roll_log` so it shows up in the Logs tab.

### Step 3 — Wedge B if there's time
- **Quantity picker**: replace single "Give" button with "Give → [qty] → [target]" two-step.
- **Notification on receive**: insert a `notifications` row (type `inventory_received`) when a transfer lands; deep-link to `/stories/<campaign>/table` (or wherever the receiver was).

### Step 4 — Consider migrating off `character.data.inventory` jsonb
Long-term, inventory items deserve their own table (`character_items` or `inventory_entries`) rather than living in the `data` blob. Benefits: searchable (e.g. "show me everyone holding a Medkit"), atomic per-item RLS, easier history. But this is a refactor that touches many files. **Don't do this on day one** unless the JSONB shape becomes a blocker.

---

## Open design questions for tomorrow (decide before coding)

1. **Hostile-only loot, or any defeated NPC?** Looting friendlies feels grim — limit to "hostile" disposition?
2. **Auto-distribute on NPC kill, or open a modal for the killing PC to choose?** Object loot is auto. NPC loot may want a choice.
3. **Range gate on loot?** Engaged or Close only? Or anyone in the scene?
4. **GM custom items library scope** — campaign-only, or setting-shared (Chased / DZ / Mongrels)?
5. **Trading with NPCs** (shopkeepers etc.) — out of scope for v1, but flag if you want it on the roadmap.

---

## Other open items not on the inventory thread

- **Sidebar dedupe** — "Looking for Group" + "Forums" appear both in the sidebar AND as Campfire tabs. Decide if sidebar links should redirect to `/campfire?tab=…`. ~5 min.
- **Per-post OG previews** — shared LFG/Forum links currently preview with the *page-level* metadata, not the specific post. Needs server-rendering or wrapper layouts. ~1–2 hr.
- **Dedicated 1200×630 OG image** — current og:image is the Distemper logo (likely letterboxed by scrapers). Purpose-built card would render better. Graphic asset.
- **Homebrew tab** — backburnered per your call. Scope still TBD when you pick it up.
- **King's Crossing Mall tactical scenes + handouts + reseed-campaign tool** — near-term items in `tasks/todo.md`.

---

## File quick-reference for tomorrow

| File | Why you'll touch it |
|---|---|
| `components/InventoryPanel.tsx` | Refactor to support NPC holder; quantity picker on Give |
| `components/CharacterCard.tsx` | Encumbrance formula dedup target |
| `components/NpcRoster.tsx` | Add Inventory button per NPC |
| `app/stories/[id]/table/page.tsx:6198–6209` | Loot transfer parent — extend for qty + notifications + NPC-side |
| `lib/xse-schema.ts` | EquipmentItem source; potential home for shared encumbrance helper |
| `lib/weapons.ts` | Weapon catalog source for InventoryPanel |
| `sql/npc-inventory.sql` | Already applied; reference for the column shape |

---

When you start tomorrow, the fastest reorientation is to read this doc + run the pending migrations + smoke-test the existing inventory. Then ping me with which wedge (A / B / C / combination) and I'll plan it in detail.
