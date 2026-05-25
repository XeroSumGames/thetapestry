# SECURITY/DATA FINDING - `characters` cross-user writes silently no-op (data loss) - 2026-05-24

**Found by:** puffer-fish sibling-RLS audit (kicked off after the E2E lane's PC-trade data-loss finding; this is that bug's broader CLASS).
**Severity:** HIGH for the beta - silent DATA LOSS across the GM loot/award/ration loop + PC-PC trade. Not a breach/PII/priv-escalation; it's lost writes + desync. **Latent today, bites at the 500-user beta.**
**Status:** **GM-half FIXED + verified live 2026-05-24** (Xero applied `sql/characters-gm-write-rls-2026-05-24.sql`; the "GM can update characters in their campaigns" UPDATE policy is present on `characters`). Flows 2-8 resolved. **Flow 1 (PC-to-PC trade): DECISION = Option B (the RPC), Xero 2026-05-24.** RPC WRITTEN (apply gated): `sql/give-item-to-character-rpc-2026-05-24.sql` (`give_item_to_character`, SECURITY DEFINER, atomic both-sides, in-function authz). Client rewire routed to Hunt & Peck (`onGiveItem` -> call the RPC, drop both raw inventory writes); E2E un-fixmes the trade assertion after. Risk Register YELLOW until the RPC is applied + the client rewired.

---

## Root cause (verified live)
`characters` UPDATE RLS = owner-only + a Thriver bypass:
- `Users can update own characters` -> `auth.uid() = user_id`
- `characters_thriver_bypass` (ALL) -> `is_thriver()`

**A GM is NOT a Thriver** - `is_thriver()` keys on `profiles.role='thriver'`, unrelated to `campaigns.gm_user_id`. So any client write to ANOTHER player's `characters` row returns 0 rows with NO error (PostgREST RLS no-op), and the data is silently lost. It "works" in playtest ONLY because dev GMs are also Thrivers (the bypass covers them). At a beta where GMs are ordinary Survivors, it breaks.

**Why combat is SAFE:** `character_states` already has `Campaign members update character_states` -> `(member of campaign OR gm_user_id = auth.uid())`. All HP/RP/stress/condition/death-countdown writes go there (verified `useRollResolution.ts:598,676`, `page.tsx:4997,8730`). Only writes riding on `characters.data` (inventory, rations, lasting-wounds, progression-log) hit the gap.

## Affected flows (audit, ranked by beta impact)
| # | Flow | Site | Actor -> owner | Verdict |
|---|---|---|---|---|
| 1 | PC->PC give item (the original E2E finding) | `table/page.tsx:6930` | player -> player | DATA-LOSS |
| 2 | NPC->PC loot give | `components/NpcCard.tsx:431` | GM -> player | DATA-LOSS |
| 3 | GM loot via LootModal | `table/components/LootModal.tsx:108` | GM -> player | DATA-LOSS |
| 4 | Object->PC loot | `table/page.tsx:10314`, `CampaignObjects.tsx:668,738`, `ObjectCard.tsx:148` | GM -> player | DATA-LOSS (checks `charErr` but RLS no-op throws none) |
| 5 | Mortal-wound progression-log to target | `useRollResolution.ts:637` | attacker -> victim | silent no-op (log only; HP safe) |
| 6 | Lasting-wound write to patient | `useRollResolution.ts:1539` | medic/attacker -> patient | DATA-LOSS (wound never persists on victim sheet) |
| 7 | CDP award progression-log | `CdpModal.tsx:75` | GM -> player | silent no-op (CDP value safe in character_states; log lost) |
| 8 | Luxury-ration stress tick | `app/campaign-sheet/page.tsx:144` | GM -> player | DATA-LOSS (ration count not decremented; stress applied -> desync) |

Flows 2,3,4,8 = GM-acting; today only work if the GM is a Thriver. Flow 1 = peer-to-peer.

## The fix (designed; split by ownership)
- **[PF] GM-of-campaign UPDATE policy on `characters`** - `sql/characters-gm-write-rls-2026-05-24.sql` (written, dry-run, apply gated). Scoped to the campaign GM (NOT "any member" - that would let any peer rewrite a teammate's full sheet). Resolves flows 2-8 in one additive policy, mirroring the trusted `character_states` model. Owner policy unchanged.
- **[PF+HP] PC->PC trade (flow 1)** - the one true peer-to-peer write; the GM policy does NOT cover it. Two options for the beta:
  - (a) **disable PC-PC trade** for the beta (fastest), or
  - (b) **a SECURITY DEFINER RPC** (`give_item_to_character(target_character_id, item)`) that PF writes (touches ONLY the inventory key, validates the giver owns the item + both are in the same campaign) and HP wires the client `give` flow to call instead of the raw `.update`. This is least-privilege (peers transfer items, cannot arbitrary-edit each other). Needs the inventory-shape detail from the give-flow code - spec, then write.

## Why GM-policy + trade-RPC, not one blanket policy
A single `(member OR GM)` UPDATE policy on `characters` (mirroring character_states verbatim) would fix all 8 at once - but it lets ANY peer player overwrite ANY teammate's entire `characters.data` (stats, inventory, everything). Among friendlies that is low-risk, but it is an over-broad grant that is hard to walk back later and is a griefing/cheating vector. GM-scoped policy + an inventory-only trade RPC is the least-privilege answer and the precedent (`update_vehicle_in_campaign`, `notify_inventory_received`) already exists.

## References
- Fix SQL: `sql/characters-gm-write-rls-2026-05-24.sql`.
- Precedent (correct cross-user pattern): `character_states` "Campaign members update character_states" policy; SECURITY DEFINER RPCs `update_vehicle_in_campaign`, `notify_inventory_received`.
- Sibling-class precedent: the campfire + map_pins server-side enforcement sweep (same "client-only / RLS gap" family).
- Originating finding (PC trade): `finding-pc-trade-rls-dataloss-2026-05-24.md` (E2E lane).
