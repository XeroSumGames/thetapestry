# P2 Spec Smoke - 2026-06-12

Four new E2E specs: `story-snapshot`, `story-join-notification`, `campaign-pins-visibility`, `session-notes`.
(story-clone dropped - Clone button was retired April 2026.)

Run from the repo root in a terminal:

```
npx playwright test e2e/story-snapshot.spec.ts e2e/story-join-notification.spec.ts e2e/campaign-pins-visibility.spec.ts e2e/session-notes.spec.ts --reporter=list
```

Report back: which tests passed, which failed, and the full error text for any failure.
