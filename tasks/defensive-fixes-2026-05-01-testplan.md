# Defensive bug fixes — 2026-05-01 testplan

Four small surface-the-failure fixes from the latest audit. One PR. Ship to live.

## What's fixed

### 1. Campaign creation now surfaces membership-insert failures
[app/campaigns/new/page.tsx:84](app/campaigns/new/page.tsx:84). Pre-fix, the `campaign_members` insert that follows the campaigns-row create was awaited but its `error` was ignored. If RLS denies that insert, the user ends up with a campaign whose `gm_user_id` matches them but no `campaign_members` row — most member-keyed features then read as if they weren't a member. Now we check the error and bail with a clear message.

### 2. CampaignCommunity dashboard load surfaces RLS / network failures
[components/CampaignCommunity.tsx:564](components/CampaignCommunity.tsx:564). The `Promise.all([moraleRes, recruitRes])` destructured `data` without checking either error. Silent failures showed as empty Morale + Recruit panels. Now: log per-result errors; the empty-state UI still shows but the cause is visible in the console.

### 3. CampaignCommunity main load same fix, four queries
[components/CampaignCommunity.tsx:613](components/CampaignCommunity.tsx:613). The `Promise.all([comsRes, npcsRes, charsRes, pinsRes])` similarly ignored every `error`. A failed `communities` query reads as "this campaign has no communities yet"; a failed `pins` query swallows pin-picker options; etc. Now: log per-result errors. Same graceful-degradation behavior, but failures are debuggable.

### 4. CampaignMap nominatim lookup logs catch
[components/CampaignMap.tsx:217](components/CampaignMap.tsx:217). `try { ... } catch {}` swallowed the underlying error. Now logs `console.warn('[mapSearch]…')` so rate-limit / network failures show up when a user reports "search didn't find my city".

No DB migration. No functional behavior change on happy paths.

## Test plan

### A. Campaign creation membership check (3 min)
- [ ] Sign in. Create a new campaign normally — membership insert succeeds, redirected to the table page. No alert.
- [ ] To force the failure path (optional): in DevTools Network, throttle to offline AFTER the campaigns insert lands but BEFORE the membership insert. Expect `setError` shows "Campaign created but membership failed: …" and the form stays. (Realistically rare; the value here is the audit trail rather than the recovery UX.)

### B. CampaignCommunity logs (5 min)
- [ ] Open the inline `<CampaignCommunity>` panel in the table page. Communities load; expand a community's Dashboard panel — Morale + Recruit data render.
- [ ] In DevTools Console, no `[community-dashboard]` or `[CampaignCommunity]` errors appear during normal loads.
- [ ] To verify logging works: temporarily revoke a SELECT policy in Supabase SQL editor (e.g. on `community_morale_checks`), reload the panel — expect the Dashboard row to render empty AND a `[community-dashboard] morale fetch:` console error. Restore the policy after.

### C. nominatim catch log (1 min)
- [ ] On the `/stories/<id>/edit` map, search for a real location — flyTo works, no log.
- [ ] Search again with the network blocked — expect the form clears, no UI breakage, and a `[mapSearch] nominatim lookup failed:` warning in the console.

### D. Build / smoke
- [ ] `npx tsc --noEmit` passes (verified pre-commit).
- [ ] `node scripts/check-font-sizes.mjs` passes.
- [ ] No console errors during normal usage of campaign creation, communities panel, or map search.

## Rollback

`git revert <commit>` then redeploy. No DB or schema changes.
