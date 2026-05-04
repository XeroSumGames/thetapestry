# Audit fixes — 2026-05-01 testplan

Bundle of items 1–4 from the audit re-run. One PR. Ship to live.

## What's in this PR

1. **Font-size guardrail clean** — TradeNegotiationModal 11→13px (auto-fixed); CampaignCommunity stockpile × button moved off banned `13px + #3a3a3a` combo.
2. **`parseInt` radix sweep** — every `parseInt(x)` → `parseInt(x, 10)` across components/lib/app.
3. **Bug fixes**
   - InventoryPanel `confirmGive` — uses an inventory ref so a realtime mutation of the prop while the give modal is open can no longer be clobbered by a stale closure on click. Also captures `givingItem` to a local at function entry.
   - CampaignObjects loot-give — checks the character `update` error before clearing the scene_token, and surfaces both errors via alert. Pre-fix: items could vanish if the character write failed but the token clear succeeded.
   - ApprenticeCreationWizard — surfaces master-PC load failures (state + error message + dedicated banner) instead of silently leaving every skill cap untrainable.
4. **MessagesBell + /messages N+1** — replaced the `Promise.all(convIds.map(... messages.select.limit(1)))` per-conversation lookup with one `rpc('get_latest_messages_for_conversations')` call. New SQL function uses `DISTINCT ON` and relies on existing RLS (no SECURITY DEFINER).

## ⚠️ Pre-deploy step (DB migration)

**Before** the new code reaches users, run this in the Supabase SQL editor:

```
sql/messages-latest-rpc.sql
```

If you push first, the messages bell + /messages page will show empty rows until the RPC exists (the supabase client returns `null` data on a missing-function 404, which the code treats as "no latest messages").

## Test plan

### A. Font-size guardrail (30 sec)
- [ ] Run `node scripts/check-font-sizes.mjs` → expect "OK".
- [ ] Open a community with stockpile items → the × on a stockpile item is muted grey, hover turns red. (Reading legible at 13px.)
- [ ] Open a Barter trade modal → rarity chips beside item names render at 13px (no longer the cramped 11px).

### B. parseInt radix (5 min)
- [ ] Character sheet → Rest UI: type `08` into the hours/days/weeks fields, hit rest. Should resolve to 8, not 0. (Pre-fix: octal interpretation in older browsers.)
- [ ] Inventory give: open give modal, qty input → type `08`. Field should resolve to 8.
- [ ] Community Morale modal: any of the AMod/SMod/CMod fields → type `08`, expect 8 in the calc.
- [ ] Stockpile add: enter qty `09` → expect 9.
- [ ] Vehicle inventory add → enter qty `08` → expect 8.

### C. InventoryPanel stale-closure fix (5 min)
- [ ] PC1 opens own inventory and clicks Give on a stack of 5 ammo.
- [ ] Before clicking a recipient, have PC2 (different tab) take/give an item that triggers a realtime sync to PC1's character row (e.g., GM gives PC1 something).
- [ ] PC1 clicks a recipient. Verify the stack-of-5 decrement does NOT roll back the realtime addition. Pre-fix: the post-give inventory would overwrite the realtime addition.

### D. CampaignObjects loot error surfacing (3 min)
- [ ] In a tactical scene, drop a lootable object with items.
- [ ] Temporarily revoke RLS on `characters` (or pick a character you don't own) and try to loot all → expect an alert "Loot failed: …" and the object STILL has its contents (no orphaned drop).
- [ ] Restore normal access; loot all again → contents transfer + object clears as before.

### E. ApprenticeCreationWizard master-PC error banner (3 min)
- [ ] Recruit an Apprentice via Moment-of-High-Insight, open the wizard.
- [ ] Skills step should say "Loading master PC: ready" once loaded; every trainable skill shows a real cap.
- [ ] Manually break the load (e.g. block the request in devtools, or supply a bogus masterCharacterId via session edit) → expect a red banner "Couldn't load the master PC's skill list…" and "failed — &lt;message&gt;" in the SRD-cap explainer.

### F. MessagesBell + /messages RPC (5 min) — **after running sql/messages-latest-rpc.sql**
- [ ] Open the messages bell with at least 3 conversations, each with messages → all conversations show the correct latest body + correct unread/read state.
- [ ] In the Network tab, the bell load should NOT fan out N requests to `/rest/v1/messages?conversation_id=eq…` — instead a single `/rest/v1/rpc/get_latest_messages_for_conversations` POST.
- [ ] Send a new message from another tab → bell auto-refreshes and shows the new latest correctly.
- [ ] /messages page list shows the same. Switching active conversation still loads its full message log.

### G. Smoke
- [ ] `npx tsc --noEmit` passes (already verified pre-commit).
- [ ] No console errors on dashboard, /messages, /communities/&lt;id&gt;, /stories/&lt;id&gt;/table after navigating around.

## Rollback plan

- Code: `git revert &lt;commit&gt;` then `vercel --prod` redeploy.
- DB: leaving the RPC in place is harmless — it's standalone and additive. No table changes.
