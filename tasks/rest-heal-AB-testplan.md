# Test plan - Rest & Heal gaps A (Stress cooling-off) + B (sick RP cap)

Shipped 2026-05-31, commit `5ba32d1`. Revert: `git revert 5ba32d1 && git push origin main`.

Recovery math is in `lib/rest.ts` (17 unit tests in `tests/lib/rest.test.ts`,
all green). This plan is the live-site eyeball on the Rest & Heal modal
(`components/CharacterCard.tsx`, the green "Rest" button on a character card).
GM-driven; best on the table page after the Vercel deploy lands.

## Setup
- A campaign with a PC whose character card you (GM) can open.
- To exercise the edges you may want to pre-set the PC's state (stress > 0,
  make them Sick, etc.) - use the existing GM stat controls or an NPC stand-in.

## A - Stress Cooling Off
- [ ] Open Rest, enter **8 hours**. The "Uninterrupted & enjoyable" toggle
      appears, defaulting ON. Preview shows "Stress reduced: -1 (1 per 8h)".
- [ ] Apply. The PC's stress drops by 1; the feed's rest row reads
      "... rested 8 hours (+N RP, +M WP, -1 Stress)".
- [ ] Enter **24 hours**, toggle ON: preview shows "-3"; apply drops 3 pips
      (canon: 24h safe+enjoyable = 3 cooling-off blocks). Floors at 0.
- [ ] Toggle OFF at 24h: preview shows no stress line; apply leaves stress
      unchanged.
- [ ] Enter **under 8 hours** (e.g. 4): no toggle, no stress line, stress
      unchanged on apply (canon 8h minimum per pip).

## B - Sick RP cap
- [ ] Make the PC Sick (infection_state = 'sickness'; via the GM infection
      button or an NPC). With rp_max = 6, the sick cap is 3.
- [ ] Open Rest with the PC's RP low (e.g. 1), enter several hours. Preview
      shows "RP recovered: +2 (1 per hour, sick cap 3)" - RP tops out at 3,
      not 6.
- [ ] Apply: RP lands at 3, not full max.
- [ ] If the PC's RP is already ABOVE the cap (e.g. 5) when sick: preview
      shows +0 RP; apply does NOT lower them to 3 (rest is not the lowering
      event - sickness onset is).
- [ ] Clear the sickness (let the infection countdown tick to 0, or GM
      clears it). Next rest regens RP up to full rp_max again.
- [ ] A non-sick character (or one with a 'wound' infection, not 'sickness')
      regens RP to full max as before - no cap.

## Regression - what must NOT have changed
- [ ] WP still heals 1/day (or 1/2-day if at 0 WP / in death countdown),
      clamped to wp_max.
- [ ] The campaign clock still advances by the rested hours (the System
      "Time advances Nh" feed row still appears) and any queued Medicine
      heal that crosses +12h/+24h still fires (Gap E - already wired).
- [ ] Lasting wounds / breaking-point penalties are untouched by rest
      (the modal only writes wp/rp/stress).
- [ ] A 0-hour apply is a no-op (closes, no feed row).

## Known gap (not in this ship)
- Gap C (post-mortal slow regen persisting to wp_max) is NOT in this commit -
  a stabilised-but-not-full PC still flips to the fast 1/day rate. SQL drafted
  at `sql/character-state-mortal-recovery-flag-2026-05-31.sql`, awaiting go.
