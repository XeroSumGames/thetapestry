# ModalBackdrop sweep — round 2 — 2026-05-01 testplan

The first round adopted `<ModalBackdrop>` in 5 single-purpose modals. This round sweeps another **21 sites across 13 files**. One PR. Ship to live.

## Scope

| File | Modals swept | Notes |
|---|---|---|
| [components/PortraitBankPicker.tsx](components/PortraitBankPicker.tsx) | 1 | Standard |
| [components/GhostWall.tsx](components/GhostWall.tsx) | 1 | Standard |
| [components/InventoryPanel.tsx](components/InventoryPanel.tsx) | 1 | Standard |
| [components/ObjectImageCropper.tsx](components/ObjectImageCropper.tsx) | 1 | Standard |
| [components/RollModal.tsx](components/RollModal.tsx) | 1 | Conditional onClose (`result ? undefined : onClose`); fontFamily moved to panel |
| [components/ApprenticeCreationWizard.tsx](components/ApprenticeCreationWizard.tsx) | 1 | Saving-guarded onClose |
| [components/CharacterCard.tsx](components/CharacterCard.tsx) | 1 | The Rest modal — single instance in this 1.1K-LOC file |
| [app/scene-controls-popout/page.tsx](app/scene-controls-popout/page.tsx) | 1 | Confirm overlay, low Z (1000) |
| [components/PlayerNpcCard.tsx](components/PlayerNpcCard.tsx) | 1 | Loot modal. Image lightbox skipped (cursor: zoom-out doesn't fit the helper's defaults). |
| [components/CharacterEvolution.tsx](components/CharacterEvolution.tsx) | 2 | Outer + nested confirm overlay. Outer's onClose is gated on `!pending && !saving` |
| [components/CampaignObjects.tsx](components/CampaignObjects.tsx) | 2 | Loot + edit modals |
| [components/MapView.tsx](components/MapView.tsx) | 2 | Link proposal + encounter modals (both `Z_INDEX.modalNested`) |
| [app/vehicle/page.tsx](app/vehicle/page.tsx) | 1 | Vehicle check modal. Floorplan lightbox skipped. |
| [app/communities/page.tsx](app/communities/page.tsx) | 2 | Invite + Create community modals |
| [components/NpcRoster.tsx](components/NpcRoster.tsx) | 3 | Add/edit NPC, Add to Combat picker, Browse Library |

## Deferred

- **3 image lightboxes** ([NpcCard](components/NpcCard.tsx), [NoteAttachmentsView](components/NoteAttachmentsView.tsx), vehicle floorplan, PlayerNpcCard portrait). They use `cursor: zoom-out` which the helper doesn't expose. Adding a `cursor` prop to the helper would let us sweep these later.
- **[components/TacticalMap.tsx](components/TacticalMap.tsx)** (2 sites) — complex canvas component, deferred for a more careful pass.
- **[components/CampaignCommunity.tsx](components/CampaignCommunity.tsx)** (4 sites) — multiple inner modals, defer for safety.
- **[app/stories/[id]/table/page.tsx](app/stories/[id]/table/page.tsx)** (17 sites) — 10K-line file, defer to a dedicated PR.

## Test plan

### A. Quick smoke per modal (~15 min)
For each swept site, open the modal, click the dim backdrop → modal closes. Click inside the panel → stays open. Specifically:

- [ ] `/characters/<id>` → Portrait Bank picker (if you have a Thriver-only entry to it).
- [ ] Sidebar Ghost Wall (if not signed in or under Thriver gate).
- [ ] Open the inventory panel from a character sheet — backdrop / inside / Close button all behave.
- [ ] In the GM Assets → Objects panel, upload a new object image → Object Image Cropper opens. Click outside cropper → cropper closes; click inside → stays open.
- [ ] Trigger any roll → Roll Modal renders. While result is null, backdrop click closes; while result is set, backdrop click does NOT close (preserved behavior).
- [ ] Recruit an Apprentice → Apprentice Wizard opens. Backdrop only closes when not saving.
- [ ] On a character card, click 🛏 Rest → Rest modal opens. Backdrop click closes.
- [ ] Open the scene-controls popout → click "Delete Scene" → confirm overlay. Backdrop closes the overlay.
- [ ] As a player NPC roster viewer, click 🩸 on a downed NPC → loot modal. Backdrop closes.
- [ ] Open Character Evolution panel (Lv-up). Backdrop closes when nothing pending. Click a Lv-4 step → confirm overlay opens. Confirm overlay's backdrop close is gated on `!saving`.
- [ ] In GM Assets → Objects → loot an object. Backdrop closes loot modal. Edit an object — backdrop closes edit modal.
- [ ] On the world map, click 🔗 Propose Link → modal opens; backdrop closes when not submitting. Same for 🤝 Encounter.
- [ ] On `/vehicle/<id>`, run any check modal. Backdrop closes.
- [ ] On `/communities`, click ✏ → invite modal. Click + → create modal. Both backdrop-close, both stay open inside.
- [ ] In the NPC roster (table page sidebar), Add NPC, Add to Combat, Browse Library — all three backdrop-close cleanly.

### B. Build / smoke
- [ ] `npx tsc --noEmit` passes (verified pre-commit).
- [ ] `node scripts/check-font-sizes.mjs` passes.
- [ ] No console errors on any of the swept pages.

## Rollback

`git revert <commit>` then redeploy. The helper file remains in place — additive, harmless to leave.
