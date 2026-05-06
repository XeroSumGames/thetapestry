# Campaign-Map Ping — Test Plan (2026-05-04)

**Ship state:** commit `1c46aed` on main; deploys to `thetapestry.distemperverse.com` after Vercel build (~60s).

**What changed:** Alt+click anywhere on the campaign map (world map view inside `/table`) drops a transient pulsing ring that broadcasts to every other viewer of the same campaign — same gesture as tactical-map ping, just on Leaflet instead of canvas.

## Smoke test (single browser, GM only)

1. Open a `/stories/<id>/table` page on a campaign that has the world map enabled.
2. Switch to the campaign-map view (whichever tab/route shows the world map; not the tactical scene).
3. Hold **Alt** and click anywhere on the map.
4. **Expect:** an orange ring + dot pulses twice over ~2.4s at the click point, then disappears. No new-pin form opens. The map does not pan or zoom.
5. Click again without Alt — placing mode is still off, nothing happens. Toggle `+ Pin` on, click without Alt → pin-form opens as before. Toggle `+ Pin` on, alt-click → still pings (does NOT open the pin form).

## Cross-browser test (GM + player)

1. GM opens the table page in browser A.
2. Player (separate account) opens the same table page in browser B (or incognito).
3. GM alt-clicks on the map. **Expect:** orange pulse on BOTH browsers within ~500ms.
4. Player alt-clicks somewhere else. **Expect:** green pulse on BOTH browsers within ~500ms.
5. Both alt-click rapidly in different spots. **Expect:** multiple concurrent pulses, each fades cleanly without leaking DOM nodes (open DevTools → Elements, search for `cm-ping-ring` after 5s of idle — count should be 0).

## Regression checks

- `+ Pin` (GM) still works: toggle on, click without Alt, pin-form appears. Save it, see the marker on the map.
- `+ Suggest Pin` (non-GM player) still works: same flow, pin lands as `revealed=false`.
- The "✓ Pin submitted — GM will review" green confirmation banner still appears after a player saves a suggestion.
- Search box, layer switcher, fly-to-pin, marker drag (GM only) — all still work.
- Switch to a different campaign in `/table` — alt-click still works, no stale pings from the old campaign appear.

## Failure modes to watch

- **Echo:** if you alt-click and see TWO pulses (one immediate, one delayed ~200ms), the broadcast is echoing to the sender. The receiver-only channel design avoids this; if it happens, check `pingChannelRef.current?.send` isn't accidentally subscribed locally.
- **Leaflet eats the alt-click:** if alt+click pans/zooms the map instead of pinging, Leaflet's box-zoom or alt-modifier handler is intercepting. Workaround: change the modifier to `e.shiftKey` (rare) or use a different gesture.
- **Channel never delivers:** open DevTools → Network → WS, look for the supabase realtime websocket. If the `campaign_ping_<id>` channel isn't subscribed (status !== "SUBSCRIBED"), you'll see only your own pulse — partner sees nothing.

## Out-of-scope (not changed in this commit)

- Press-and-hold ping gesture (the tactical map's #31-playtest gesture). Campaign map only supports alt+click for now.
- Audio cue on ping receive.
- Ping cooldown / rate limit. Spam-protected only by the Supabase realtime broadcast quota.
