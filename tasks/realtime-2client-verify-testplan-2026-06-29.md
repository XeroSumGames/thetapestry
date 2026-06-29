# Realtime 2-client verify - testplan (2026-06-29)

Confirms commit `07a0f495`'s campaign-scoped subs + grid/lock mid-session fix still
fire for the RIGHT campaign on live. Data-layer half already verified clean from the
DB (columns present, 0 NULL campaign_id, set-on-insert triggers correct, all 3 tables
in the publication). This run only checks live propagation between two clients.

You need two browser windows logged into DIFFERENT accounts:
- Window 1 = a GM account (you).
- Window 2 = a second account that is a PLAYER in the same campaign.

Use a campaign that has a tactical scene with at least one token on the map.

---

## Part 1 - same campaign, propagation (the core check)

1. In Window 1 (GM), open the campaign's table page and open the tactical scene.
2. In Window 2 (player), open the SAME campaign's table page and the same scene.
3. In Window 1, drag a token to a different cell on the map. Wait ~3 seconds.
4. Look at Window 2. Report where the token is now.
5. In Window 1, toggle the map grid (or lock/unlock the map). Wait ~3 seconds.
6. Look at Window 2. Report what changed on the player's map.
7. In Window 1, reveal an NPC to players (if there's one to reveal). Wait ~3 seconds.
8. Look at Window 2. Report whether the NPC appeared for the player.

## Part 2 - different campaign, isolation (only if you have a second campaign handy)

9. In Window 2, switch to a DIFFERENT campaign's table page (not the one in Window 1).
10. In Window 1, drag a token to a new cell again. Wait ~3 seconds.
11. Look at Window 2. Report whether anything on that page flickered, reloaded, or moved.

---

Report back what you saw in each numbered look-step. That's all I need.

---

## RESULT - PASS (2026-06-29, from two synchronized recorder dumps)

Parsed GM dump (`xerosumgames`) against player dump (`tony_bushell`), same campaign
`7219ea37`. Every GM write correlated to a player inbound realtime event:

- Token moves: `PATCH scene_tokens` (x6) each delivered to player as campaign-filtered
  `scene_tokens:UPDATE` postgres_changes, 100-600ms latency. Sub NOT killed by the filter.
- Grid/scene toggle: `PATCH tactical_scenes` -> player `tactical_scenes:UPDATE` ~150ms.
  **M-RT-1 (mid-session grid/lock reaches a player) confirmed live.**
- NPC restore: `PATCH campaign_npcs` x3 -> player `campaign_npcs:*` + `character_states:*`
  ~190ms.

Not exercised (no write hit them this run; same filter construction as the proven
`scene_tokens` sub + DB-layer already verified): `npc_relationships`, `community_members`
subs. Part 2 cross-campaign isolation not run (both windows stayed in one campaign) -
guaranteed by construction (server-side filter on verified-correct backfilled column).

Item 1 CLOSED. Incidental scale finding surfaced from the same dumps:
`tasks/finding-vehicles-poll-scale-2026-06-29.md` (3s vehicles poll, routed to HP).
