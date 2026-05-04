# Button family — 2026-05-01 testplan

New `<Button>` component in [lib/style-helpers.tsx](lib/style-helpers.tsx) + a small proof-of-pattern sweep. One PR. Ship to live.

## What's added

[lib/style-helpers.tsx](lib/style-helpers.tsx) gains a `<Button>` component with two prop axes:

**Tones** (color palette — pick by visual feel):
- `primary` — red, white text. Default CTA (Save, Submit, Apply Selected).
- `secondary` — grey, neutral text. Cancel / Close / passive default.
- `confirm` — green. Apply, Yes, OK on a destructive prompt.
- `warning` — amber. Caution flows.
- `info` — blue. Informational / non-destructive next steps.
- `magic` — purple. Module / Apprentice / Schism / world-feature flows.
- `danger` — red text on dark red. Delete row, Remove, destructive undoable actions.

**Sizes**: `sm` (4×10 / 13px), `md` (8×12 / 13px, default), `lg` (10×18 / 14px).

Plus: `disabled` (constraint-blocked), `busy` (async-pending → `cursor: wait`), and a `style` override for one-offs (`flex: 1`, custom width, `marginTop`, etc.).

Hover effects intentionally NOT baked in — the codebase doesn't use JS hover for action buttons; affordance is color + cursor change.

## What's swept

Proof-of-pattern, deliberately small to keep the diff reviewable. Sweeping more sites as future PRs. The audit identified ~438 button-style blobs total — this PR adopts 5 of them as a working pattern.

| File | Buttons |
|---|---|
| [components/ApprenticeCreationWizard.tsx](components/ApprenticeCreationWizard.tsx) | Continue (`magic` `lg`), Save Apprentice (`confirm` `lg`) |
| [app/communities/page.tsx](app/communities/page.tsx) | Invite modal Close (`secondary` `lg`) + Send Invite (`primary` `lg`); Create modal Cancel + Create Community (same) |
| [components/QuickAddModal.tsx](components/QuickAddModal.tsx) | Bottom Done button (`secondary` `lg`) |

Buttons that use local style consts (e.g. CommunityMoraleModal's `primaryBtn`/`chipBtn`/`dangerBtn`) are **deferred** — they already follow a contained local pattern; sweeping them needs more care.

Buttons with "ghost" outline styling (transparent bg + colored border) are **deferred** — not covered by current tone palette. A `ghost` tone variant could be added later if the pattern is common enough.

## Test plan

### A. Each swept button works (~5 min)
- [ ] Recruit an Apprentice → wizard opens. Walk through Identity → Profession → RAPID → Skills steps. **Continue** button is the new Button helper (purple/magic, lg) — fires the right step transition; disables when constraints unmet.
- [ ] Reach Confirm step. **Save Apprentice** button (green/confirm, lg) — saves and `busy={saving}` flips its cursor to wait while the server write is in flight.
- [ ] On `/communities`, click ✏ → Invite modal. Close + Send Invite buttons render correctly; Send is disabled until both pickers are set; clicking Close closes the modal.
- [ ] On `/communities`, click + → Create Community modal. Cancel + Create buttons render; Create disabled until campaign + name set.
- [ ] Open QuickAddModal (table page Quick Add or world-map double-click). Bottom **Done** button works; closes the modal.

### B. Disabled / busy visual
- [ ] An Apprentice "Continue" with constraints unmet — button is dimmed (opacity 0.5), `cursor: not-allowed`.
- [ ] An Apprentice "Save" mid-save — button shows "Saving…" text and `cursor: wait`.
- [ ] A "Send Invite" with neither picker set — dimmed + not-allowed cursor.

### C. Build
- [ ] `npx tsc --noEmit` passes (verified pre-commit).
- [ ] `node scripts/check-font-sizes.mjs` passes.
- [ ] No console errors during the swept flows.

## Rollback

`git revert <commit>` then redeploy. The Button helper itself is additive and harmless to leave even if the sweep rolls back.
