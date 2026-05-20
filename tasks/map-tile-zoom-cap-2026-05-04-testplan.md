# Map tile-provider zoom cap - 2026-05-04 testplan

Hard-cap user zoom per tile provider so we don't request tiles past the provider's native max. Reported: OpenTopoMap returns a "max zoom layer = 17" placeholder image past zoom 17, which then tiles the entire viewport on the user's screen.

Two commits - the first attempt used `maxNativeZoom` (let users zoom past the cap, Leaflet upscales the tile blurry); second swapped to hard-cap (user's zoom-in button greys out at the provider's max). Hard-cap won because blurry tiles aren't useful for pin-placement work - a clean stop is clearer.

## What changed

Both [components/CampaignMap.tsx](components/CampaignMap.tsx) and [components/MapView.tsx](components/MapView.tsx):

1. Each tile provider entry gained a `maxZoom` field reflecting its actual native cap.
2. The tileLayer creation passes that `maxZoom` to Leaflet.
3. `switchLayer` (and the equivalent layer-set call in MapView) calls `map.setMaxZoom(t.maxZoom)` and clamps the current zoom if the user was past the new cap.
4. Map init uses the initial layer's `maxZoom` instead of a hard-coded `19`.

| Provider | maxZoom |
|---|---|
| street, satellite, dark, positron, voyager, humanitarian | 19 |
| topo (OpenTopoMap) | **17** |

Result: on topo, zooming past 17 isn't possible. + button greys out, scroll-wheel zoom stops, no placeholder tiles.

## Test plan

### A. The reported bug (3 min)
- [ ] Open a campaign map. Set tile style to `topo`. Zoom in until the + button greys out (should be at z17).
- [ ] Scroll-wheel zoom past that point. No effect. No placeholder tiles ever render.
- [ ] Same drill on the world map (`/map`).

### B. Other styles unaffected (2 min)
- [ ] Switch to `street`, `satellite`, `dark`, `positron`, `voyager`, or `humanitarian`. Zoom in fully - cap at 19 (unchanged).

### C. Cross-provider zoom clamp (2 min)
- [ ] On any non-topo style, zoom in to z19. Switch to topo. View should auto-zoom-out to z17 (one-frame snap). No placeholder visible.
- [ ] Switch back to a z19 style. + button works again up to z19.

### D. New tile provider checklist (reminder for future)
- [ ] When adding a new tile provider, set its `maxZoom` field to what the provider actually serves. Defaults are usually 18-19 for OSM-derived providers, 17-18 for terrain providers, varies for satellite.
- [ ] If unsure, the placeholder image will tile your screen at the cap+1 zoom - easy to spot.

### E. Build
- [ ] `npx tsc --noEmit` passes.

## Rollback

`git revert 87acdef ab8eeb5 --no-edit && git push origin main`. Restores `maxZoom: 19` everywhere - placeholder tiles return on topo past z17.

## History

- `ab8eeb5` - initial fix using `maxNativeZoom` (upscale blurry instead of placeholder). Replaced.
- `87acdef` - replaced with hard-cap `maxZoom` per provider.
