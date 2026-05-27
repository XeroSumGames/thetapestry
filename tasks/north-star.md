# North Star - Xero Sum Games

**Validated with Xero 2026-05-27.** The single anchor every lane and every session prioritizes against. Per the advisor mandate (`operating-mode.md`): *everything we do should be geared toward this goal.* When in doubt about priority, ask "what most moves us toward this?"

## The provider
Xero Sum Games = a sustainable VTT provider. Multiple platforms, **one engine**: the **Xero Sum Engine (XSE)**, a proprietary TTRPG (specified in the XSE SRD). Build approach: **perfect TheTapestry 1.0, then port it** to the other two.

## The three platforms
| Platform | Setting | Domain | Status | GMing |
|---|---|---|---|---|
| **Distemper** (TheTapestry) | post-apocalyptic | thetapestry.distemperverse.com | **SPEARHEAD - live 9/1** | free for 1-2 modules, else paid |
| **Displaced** (TheTableau) | hard sci-fi | thetableau.xerosumgames.com | later (port after Tapestry) | free for 1-2 modules, else paid |
| **XSE vanilla** (TheTable) | any genre | thetable.xerosumgames.com | published when ready, no official launch | **fully free incl. GMing** |

## Monetization model
- **Free forever, all three platforms:** playing + community. Always.
- **TheTable:** entirely free, GMing included.
- **Tapestry & Tableau:** play + community free; **1-2 free GM-able modules** (currently Empty, The Arena, maybe District Zero - TBD). **Paid subscription required to (a) create your own campaign, or (b) run gated content** purchased via `/rumors` (Minnie, Chased, etc. are gated).
- **Per-platform subscription**, ~$5/platform, discount for both (TBD). **Players free; GMs pay.**
- Entitlements model = a **per-platform GM seat** + **content-access gating** (free-content allowlist vs gated `/rumors` content). NOTE: this supersedes the merge-plan's generic per-product free/paid tier - reconcile `C:\TheTableau\tasks\merge-plan.md` entitlements section to this model when the platform/billing work starts (~10/1).

## Scale target
~50k users, ~10k paying. Ratio ~1 GM : 4 players (all GMs pay, players free) -> ~10k GM subscriptions.

## Launch sequencing (the timeline everything serves)
- **Beta-500 - 7/1:** ~500 free friendlies prove it. All get free GM accounts.
- **9/1 - KICKSTARTER launch** for the whole Distemper project (TTRPG + comic + VTT), ~30-day campaign. **Only TheTapestry goes live.** Backers get a **blanket free-GM account** (can run anything, gated or not) -> drives final playtesting + bug-fixing.
- **~10/1 - post-KS:** system fully live/open -> the player-free / GM-paid subscription model + Stripe + content-gating turn on. **Billing / entitlements / gating are NOT a 9/1 blocker** - they are a fast-follow after the campaign.
- **Later:** TheTableau (port). **When-ready:** TheTable (soft-publish, no official launch).

## The 9/1 KS-ready bar
9/1 is a **marketing + funding moment**, not just a tech milestone - backers decide whether to pay based on what they see. The bar (Xero, verbatim): **"the platform is stable, polished, and fun. When people go there, it should look great and be intuitive and have a lot of things for people to explore. It can still be bare bones, but it must look and feel promising."** => Reliability + polish + first-impression > feature-completeness.

## How this drives prioritization (now -> 9/1)
Everything serves "make TheTapestry stable, polished, and fun for the Kickstarter." In priority order:
1. **Reliable core table loop** - the heart of play (tactical map, combat, rolls, the live session). A session must never fall apart at the table. **#1.**
2. **Polish + first-impression** - it must look great and feel intuitive in a backer's first five minutes; "lots to explore."
3. **Beta-safety floor** - uptime / alerting / backup so 7/1 and the KS run safely.
4. **DEFER to ~10/1 (off the 9/1 path):** Stripe, GM-seat entitlements, content-gating, `/rumors` purchase flow. The 3-VTT platform / monorepo comes after.
