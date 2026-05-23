# Architecture target (ADR) - the locked invariants

Promoted from `tasks/grand-rearchitecture-2026-05-22.md` Part 2 at Phase 4. This
is the canonical statement of the layering + the fitness functions that enforce
it. "Does the code match the ideal?" is answered by CI, not opinion.

## The one invariant

> **Dependency direction points down. Nothing imports upward. No `.from()` outside the data seam. No `.channel()` outside the realtime seam.**

```
L0  lib/database.types.ts            generated schema truth
L1  lib/data/*       typed repository/query modules; the ONLY home of .from()
    lib/realtime/*   useCampaignChannel primitive + typed event registry; ONLY home of .channel()
L2  lib/* (pure)     rules/math engines: no React, no Supabase, unit-tested
L3  hooks/*          state machines composing L1+L2 (useInitiative, useRollResolution, ...)
L4  components/*     dumb: props in, callbacks out, no business logic, no .from/.channel
L5  app/**/page.tsx  thin route: params + load + compose hooks/components
```

## Each rule -> its fitness function (all wired to CI as of Phase 4)

| Invariant | Enforced by | Severity today |
|---|---|---|
| God-components shrink, never grow | `scripts/check-arch.mjs` LOC ceilings (ratchet) | locked (7 files) |
| `.from(` only in `lib/data` | `check-arch.mjs` seam-leakage (ratchet, monotonic down) | locked (baseline, falls per migration) |
| `.channel(` only in `lib/realtime` | `check-arch.mjs` seam-leakage | locked (one raw `presence` channel remains; see note) |
| No prod `console.*` | `check-arch.mjs` prod-console (ratchet) | locked (baseline, falls per migration) |
| No circular imports | `.dependency-cruiser.cjs` `no-circular` | **error** (green) |
| `lib/` never imports `app/` | dep-cruiser `lib-no-upward-to-app` | **error** (green) |
| `lib/` never imports `components/` (runtime) | dep-cruiser `lib-no-upward-to-components` | **error** (green; type-only imports allowed) |
| `components/` never imports `app/` route internals | dep-cruiser `components-no-route-internals` | **error** (green) |
| No test imports in app/lib/component code | dep-cruiser `no-orphan-tests-in-graph` | **error** (green) |

CI (`.github/workflows/test.yml`) now runs: font, role, em-dash, preview-sync,
`arch:check` (check-arch), `arch:depcruise`, tsc, vitest. Previously only
font/role/tsc/tests ran - the ratchet was local-hook-only. That gap is closed.

### Known temporary exception
- `app/stories/[id]/table/page.tsx` keeps ONE raw `supabase.channel(presence_table_${id})`. `useCampaignChannel` has no presence support; counted in the `.channel` ratchet baseline. Resolve by adding a small `usePresenceChannel` primitive OR keeping it as the single documented exception (decide during Phase 5/6).

## Reference checklist - run per god-component at the end of each Phase 5 migration

A component "passes" when:
1. **Zero `.from(`** in the file (all reads/writes via `lib/data/*`). (check-arch seam-leakage)
2. **Zero `.channel(`** in the file (all realtime via `lib/realtime/useCampaignChannel`). (check-arch)
3. **Zero bare `console.*`** in render/handler paths. (check-arch prod-console)
4. **No upward imports** (dep-cruiser green).
5. **Business logic lives in hooks/lib, not the component** - the file is props-in/callbacks-out (L4) or a thin route (L5). (judgment + LOC ceiling trending toward target)
6. **tsc clean + full vitest suite green.**
7. **Pure logic extracted to `lib/` has unit tests.**
8. **2-client smoke** for anything realtime (batched to the Phase 7 acceptance).

The ratchets make conformance automatic: each migration can only move the
numbers DOWN, so a regression fails CI. After this, conformance is a property
CI maintains, not vigilance that decays.
