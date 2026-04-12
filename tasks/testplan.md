# Test Plan: Combat Bug Fixes

## Changes Made

### Fix 1+2: All combat rolls now gated
- `handleRollRequest` now blocks ALL rolls (weapon + skill) during combat if the roller isn't the active combatant or has no actions remaining
- Previously only weapon rolls were gated; skill rolls could be used freely

### Fix 3: NPC damage visible in real-time
- NpcRoster now subscribes to Supabase realtime on `campaign_npcs` table
- When damage lands, the roster refreshes automatically

### Fix 4: NPC mortal wounds + stabilization
- NPCs at 0 WP now enter mortal wound state (death_countdown = 4 + PHY)
- NPCs at 0 RP (but WP > 0) become incapacitated (incap_rounds = 4 - PHY)
- Death countdown ticks each combat round
- Stabilize button appears for mortally wounded NPCs
- Dead/mortal/unconscious badges show on NPCs in initiative
- Dead and unconscious NPCs are skipped in turn order
- NPC RP recovery happens each round (same as PCs)

### Fix 5: Roll log naming
- PC weapon attacks now include character name in label (e.g. "Mila Kade — Attack (Light Pistol)")
- Label display strips the name prefix to avoid redundancy with the character_name header

### DB Migration Required
Run `sql/npc-death.sql` to add `death_countdown` and `incap_rounds` columns to `campaign_npcs`.

---

## Test Cases

### Combat Action Gating
1. Start combat with a PC (2 actions)
2. Use Aim (1 action consumed, 1 remaining)
3. Attack with weapon from character sheet (opens roll modal)
4. Complete the roll and close modal → action consumed, **turn should auto-advance**
5. Try opening a skill roll from the character sheet → **should be blocked** ("No actions remaining" or "not your turn")
6. Switch to another player's view → confirm they can't roll skills when it's not their turn

### NPC Damage Visibility
7. As GM, deal damage to an NPC
8. **Without refreshing**, check:
   - NPC card (if open) shows updated WP/RP
   - NPC roster sidebar shows updated health
9. As another client (second browser tab), confirm damage appears without refresh

### NPC Mortal Wounds
10. Deal enough damage to reduce an NPC to 0 WP
11. **Expected**: NPC gets 🩸 badge in initiative, death_countdown starts (4 + PHY rounds)
12. NPC's turn should still come up (they're mortal, not dead yet)
13. A "🩸 Stabilize [NPC Name]" button should appear in the active combatant's action bar
14. Roll stabilize:
    - **Success**: death_countdown clears, incap_rounds set, message in feed
    - **Failure**: "Failed to stabilize" message, countdown continues
15. If not stabilized, let rounds pass → when countdown hits 0, NPC gets 💀 badge
16. Dead NPC should be **skipped** in turn order
17. NPC at 0 RP (but WP > 0) → 💤 badge, skipped in turn order

### Roll Log Naming
18. As a PC, attack with a weapon
19. Check the roll feed — should display:
    - Header: **MILA KADE** (character_name)
    - Label: **Attack (Light Pistol)** (name prefix stripped)
    - NOT "Mila Kade — Attack (Light Pistol)" redundantly

### Charge / Rapid Fire (Regression)
20. Use Charge (2-action attack) — confirm it costs 2 actions and turn advances
21. Confirm closeRollModal doesn't double-consume by eating from the next combatant
