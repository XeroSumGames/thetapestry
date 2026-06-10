# Finding - combat-flow Phase A "Start Combat" UI path is failing on prod (Start Combat button doesn't appear)

**Lane:** routed to **Hunt & Peck**.
**Severity:** **HIGH** for test infrastructure - blocks both combat-flow #10 Phase A re-runs AND any new spec that exercises Start Combat (e.g. the 2026-06-01 grapple-family contract net). Not a player-impacting bug as far as this finding can confirm without manual verification.

## Trigger

Discovered while extending `combat-flow.spec.ts` with the grapple-family contract net (2026-06-01 brief, Subdue + Break Free rework). The new spec reuses Phase A's setup pattern (throwaway campaign + marv joins + GM seeds NPC + Start Session + Start Combat). It failed at `getByRole('button', { name: /start combat/i })` not appearing after `Start Session`. Cross-checked Phase A itself - it fails the same way on the **current HEAD** (re-ran 2026-06-01 against the live suite):

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /start combat/i }).first()
```

Phase A last passed in the 2026-05-30 re-cert (138 passed); it does NOT pass on the current HEAD.

## What's almost certainly NOT the cause

- The 4 combat-flow data-testids commit (`abbdfac`) - additive HTML attributes, no behavior change.
- The grapple-modal migration (`abe87e4`) - changes the grapple modal, not session/combat-start.
- AUDIT M5 realtime-wrap (`b982759`) - Sentry tagging only, no UI change.
- Wall-segment door RPC (`b2e7663`) - tactical map only.

## What this finding **cannot** distinguish

This is a TIMEOUT failure on a button-not-found at the assertion. The `Start Session` click in the test wraps in `.catch(() => {})` so a silent failure on THAT step would also produce this symptom. Three plausible root causes - HP investigation needed to pick one:

1. **`Start Session` click is silently failing** (some new gate post the rest-finish A+B+C work `5ba32d1`/`e468345` - the rest changes touch session machinery). The downstream `Start Combat` button never appears because the session never started.
2. **`Start Combat` button has been renamed or restructured.** `getByRole('button', { name: /start combat/i })` is a substring match; a rename like "Start the Combat" would still hit, but a label change to e.g. "Begin Encounter" would not.
3. **A new precondition gate** (e.g. "must have at least one NPC seeded into the initiative pool with a specific shape") that the test's existing NPC seed doesn't satisfy. The broken-weapon gate work (`fc9f402`+`3e9c39d`) is unlikely to be it (it's about weapon firing) but couldn't be ruled out by code inspection alone.

## Recommended HP investigation

Open the table page as the GM in a fresh throwaway campaign, click Start Session, observe the action bar / combat-start affordance. Either confirm option (2) (text changed - reply with new selector) or option (1)/(3) (something earlier broke). The screenshot from the failed retry is in `playwright-report/data/...` of the latest run if HP wants to peek at exactly what the UI looked like at timeout.

## What's parked on this

- `e2e/grapple-family.spec.ts` (new this batch): full draft of the Grapple roll-shape contract test. Uses the same Start-Session -> Start-Combat path. `test.fixme`-parked with a pointer to this finding. Un-fixme when Phase A is green again - the grapple test then either passes (UI driver works through Grapple modal too) or fails red against the **next** broken step.
- `combat-flow.spec.ts` Phase A: was the canonical fixture for this flow. Standalone fail today.

## On fix

Ping E2E. I un-fixme the grapple spec + re-cert Phase A in one batch. Grapple Subdue / Break Free contracts (the other two thirds of the 2026-06-01 brief) layer on top of the same setup.

## Cross-references

- 2026-06-01 grapple brief lives in chat (not in /tasks).
- Phase A test: `e2e/combat-flow.spec.ts` line ~92.
- Setup helper: `setupThrowawayWithMarvPc` in the same file.
- Dashboard last full re-cert state: 2026-05-30 = 138 passed / 0 failed / 0 flaky.
