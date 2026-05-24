# Active Lanes - live status board

Each of the three chats updates ITS OWN row at the START and END of a work batch
so the other two can steer clear of the same area (the substrate can't otherwise
show in-flight focus). Keep it to a few lines per lane. Convention + ownership:
[tasks/lane-protocol.md](lane-protocol.md).

Format per lane: **focus** (what right now) / **touching** (files/area) /
**updated** (timestamp + HEAD you're working from).

---

## Hunt & Peck
- **focus:** (set me)
- **touching:** (set me)
- **updated:** (set me)

## Puffer Fish
- **focus:** (set me) -- inbox: map_pins moderation-bypass finding ([tasks/security-finding-map-pins-moderation-2026-05-24.md](security-finding-map-pins-moderation-2026-05-24.md)) awaiting Risk Register triage.
- **touching:** (set me)
- **updated:** (set me)

## Playwright / E2E
- **focus:** Full-suite build, Phase 1 (4/7 green: story-lifecycle, rules-deeplinks, campfire-social, world-pin-to-queue). Next: presence, account-settings. messages-dm parked on Xero's teardown call.
- **touching:** `e2e/` (additive specs), `tasks/beginners-guide-testplan.md`, `tasks/e2e-results-2026-05-24.html`.
- **updated:** 2026-05-24, working from HEAD 4f9b3aa.
