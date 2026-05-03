# gm-kit scope + lazy JSZip — 2026-05-03 testplan

Two related fixes in [lib/gm-kit.ts](lib/gm-kit.ts). One PR. Ship to live.

## What's fixed

### 1. `scene_tokens` fetch was unscoped (real perf + RLS exposure)

Pre-fix line 62 was:

```
supabase.from('scene_tokens').select('*'),
```

inside the Wave 1 Promise.all — **no campaign or scene filter at all**. Every GM Kit export streamed the entire `scene_tokens` table across the wire, with a client-side `.filter(t => sceneIds.has(t.scene_id))` as the only narrowing. RLS was the only real defense; if RLS ever drifted, this would have leaked other campaigns' tokens.

Now: Wave 1 fetches campaign + pins + npcs + scenes + notes (everything filterable by `campaign_id` directly). Wave 2 sequentially fetches `scene_tokens.in('scene_id', sceneIds)` once we have the scene IDs. Pure server-side filtering.

### 2. `JSZip` was a top-level import

Pre-fix `import JSZip from 'jszip'` at line 19 pulled ~50KB into any client bundle that imported `lib/gm-kit.ts` — even bundles that never reach the export button. Now it's a dynamic import inside `exportGmKit`:

```
const { default: JSZip } = await import('jszip')
```

Cost is gated to actual GM Kit exports.

No DB migration. No functional behavior change.

## Test plan

### A. GM Kit export still works (5 min)
- [ ] Open a campaign you GM. Trigger GM Kit Export (wherever that's surfaced).
- [ ] Verify the download fires with filename `gm-kit-<slug>-<date>.zip`.
- [ ] Open the zip. Confirm:
  - `manifest.json` shows correct counts (pins / npcs / scenes / tokens / notes).
  - `tokens.json` has the same scene_id keys as before, with the same per-token data.
  - `images/` contains the same scene backgrounds, NPC portraits, token portraits, note attachments.
- [ ] Confirm the manifest's `tokens` count matches what you'd expect for THIS campaign's scenes only (no foreign tokens).

### B. Network trace shows scoped fetch (2 min)
- [ ] In DevTools Network during the export, filter by `scene_tokens`. The request should now include `scene_id=in.(...)` rather than an unfiltered `select=*`.
- [ ] Payload size on that request should drop dramatically if your DB has many campaigns. (For a single-campaign DB it's a wash — but the fetch shape is now correct regardless.)

### C. JSZip lazy-load (3 min)
- [ ] Cold-load any page that touches `lib/gm-kit.ts` (e.g. the GM screen). In DevTools Network, JSZip's chunk should NOT load.
- [ ] Click the Export button. JSZip's chunk loads on-demand right before the export runs. First export feels imperceptibly slower (one extra ~50KB fetch); subsequent exports cached.

### D. Edge cases (2 min)
- [ ] Campaign with **zero scenes** → no `scene_tokens` request fires; manifest tokens count = 0; export completes.
- [ ] Campaign with scenes but **zero tokens** → `scene_tokens` request fires with the `.in(...)` filter; returns empty; export completes.

### E. Build / smoke
- [ ] `npx tsc --noEmit` passes (verified pre-commit).
- [ ] `node scripts/check-font-sizes.mjs` passes.
- [ ] No console errors on the export flow.

## Rollback

`git revert <commit>` then redeploy. No DB or schema changes.
