# Sentry-example drop — 2026-05-03 testplan

Whole-route delete of two demo files the Sentry setup wizard left
behind. No callers, no value. One commit, ship to live.

## What's removed

- `app/sentry-example-page/page.tsx`
- `app/api/sentry-example-api/route.ts`

Both verified zero callers across the codebase via grep on `sentry-example`. Production Sentry init lives in `instrumentation-client.ts` (per the wizard config from `cc7cf15`) and is unaffected.

## Test plan

### A. Production Sentry still captures (3 min)
- [ ] Visit any page that's instrumented. Trigger a deliberate client-side error (e.g. paste `throw new Error('sentry test ' + Date.now())` in DevTools console).
- [ ] Check the Sentry dashboard (xero-sum-games org / thetapestry project) for the error within ~30s.
- [ ] If no event arrives → revert the commit. The deletion accidentally pulled init wiring.

### B. Routes return 404 (1 min)
- [ ] Visit `/sentry-example-page` directly → 404.
- [ ] Hit `/api/sentry-example-api` → 404.
- [ ] No console errors on either; clean 404.

### C. Build / smoke
- [ ] `npx tsc --noEmit` passes.
- [ ] `next build` succeeds (Vercel deploy).

## Rollback

`git revert 68505c4 --no-edit && git push origin main`. Both files restored.
