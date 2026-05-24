# Test plan - the "final test" Playwright E2E acceptance suite

Greenfield Playwright suite that walks prod and locks in two wins as a
permanent regression gate:

1. **Zero console errors + zero in-scope failed requests** on every route
   (the Phase 6 console-silence payoff).
2. **Realtime propagation** GM -> player without refresh (the re-arch payoff).

Runs SEPARATELY from the 548 vitest unit tests. `npm test` is unchanged.

---

## One-time setup (already done by Claude)

- `@playwright/test` installed (devDependency) + chromium browser binary.
- `playwright.config.ts` (targets prod, headless), specs in `e2e/`.
- `package.json` scripts: `test:e2e`, `test:e2e:headed`, `test:e2e:report`, `e2e:auth`.
- `.gitignore`: `e2e/.auth/`, `playwright-report/`, `test-results/` (auth JSON is credentials - never committed).

---

## Step 1 - capture login sessions (YOU log in; passwords never automated)

A browser window opens; log in; the session saves automatically when you
reach the dashboard (or press ENTER in the terminal to save immediately).

GM (Xero):

    node e2e/capture-auth.mjs gm

Player (MARV) - log in as tony_bushell@hotmail.com in the window that opens:

    node e2e/capture-auth.mjs player

Produces `e2e/.auth/gm.json` and `e2e/.auth/player.json`. Re-run whenever a
run reports a `/login` bounce (Supabase sessions expire).

> Note for the player capture: it opens the same browser; just type MARV's
> credentials, not Xero's.

---

## Step 2 - run the console + network sweep (Layer 1)

    npm run test:e2e

- Walks 86 static routes + 5 disposable-campaign (THE ARENA) routes as the GM.
- Asserts: no console errors, no uncaught page errors, no in-scope (our host +
  Supabase) failed/non-2xx requests, and no redirect to `/login`.
- Without captured auth, every test SKIPS (so a fresh checkout / CI still
  installs + typechecks cleanly).

Open the HTML report after a run:

    npm run test:e2e:report

### Reading a failure
The failure message names the route and lists exactly what was dirty
(console error text + source, uncaught errors, or `HTTP 4xx/5xx: <url>`).
Third-party failures (Cloudflare/Sentry/analytics) are recorded but NOT
asserted - only our origin + Supabase count.

### Allowlists (the escape valve)
`e2e/_console.ts` holds two small allowlists for genuinely-external noise
(Turnstile console retry, favicon/monitoring non-2xx). They start near-empty.
Grow them only with a one-line reason - never to hide an app regression. If a
real app error shows up, fix the app, do not allowlist it.

---

## Step 3 - realtime propagation (Layer 2) - NEXT SLICE, after Step 1 works

Two browser contexts in one test (GM + player). GM acts; player asserts the
update lands without a refresh. Planned coverage, in order:

- [ ] Combat-start: GM starts combat on THE ARENA -> player view shows
      "IN COMBAT" + the initiative order (text selectors, no app edits).
- [ ] Token move on the tactical map (`<canvas>` - the hardest seam): needs a
      small behavior-preserving `data-testid` / JS-eval bridge on TacticalMap.
- [ ] End-of-combat wound-infection MODAL fires for the wounded PC's owner
      (the one thing the manual smoke left unverified - bake into the combat
      spec: damage a PC -> see the warning feed row -> END COMBAT -> assert the
      player's modal).

These are deferred until Step 1 runs green, because they need a live session to
verify and the canvas hooks touch a god-component (LOC ratchet) - no unverified
app edits go to prod.

---

## Pass criteria
- `npm run test:e2e` green: every route clean, no `/login` bounce.
- (Layer 2, when built) every GM action replicates to the player context
  without refresh; the infection modal fires.

## Notes / bright lines the suite must never cross
- Prod is the env (no staging). All writes go against THE ARENA + the test
  accounts only. No account creation, payments, content deletion, messaging,
  moderation, or bulk ops on real data.
