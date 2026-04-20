# Feature Spec — Module System

**Goal**: Let a GM/Thriver set up an adventure or campaign **inside The Tapestry** — authoring NPCs, pins, tactical scenes, handouts, object tokens, pregens, and (eventually) communities through the normal GM UI — then **publish it as a reusable module** that other GMs can pick when creating a campaign. Content authored once, deployed to many tables, updatable over time.

**Status**: Spec — not yet implemented.

**Strategic weight**: 🚩 Flagship. This is the **content engine** that turns The Tapestry from a single-GM tool into a publishing platform. Every adventure you, licensed creators, or community authors produce becomes discoverable, subscribable, and playable without code deploys. Pairs directly with Communities (spec-communities.md) — a module can ship with pre-authored communities that downstream GMs adopt and grow.

---

## 0b. Prior art — GM Kit v1 (paused)

A first pass already exists and informs this spec. The "GM Kit v1" button on a campaign's overview page exports a zip (`lib/gm-kit.ts`) with pins / NPCs / scenes / tokens / handouts JSON plus an `images/` folder. `/tools/import-gm-kit` ingests a kit zip into `setting_seed_*` tables, and `/stories/new` + `/campaigns/new` seed new campaigns from those tables (with background images, portraits, and handout attachments intact). Wired through the `arena` setting key in `lib/settings.ts`.

**Why it paused**:
1. Image URLs in seeds still point at the source campaign's storage bucket — delete the source and seed images 404.
2. Scene `tokens.json` round-trips through the kit but neither the seed schema nor the create flow ingests it (objects placed on tactical maps don't carry through).
3. The whole seed-table approach is duplicate plumbing next to what this spec proposes — which unifies authoring, publishing, and cloning through a single module snapshot model.

**What this spec keeps from GM Kit v1**: the export surface (`lib/gm-kit.ts`) becomes the backing loader for the module snapshot — same logic, different sink (a `module_versions.snapshot` jsonb instead of `setting_seed_*` tables). Storage-asset re-upload into a module-scoped bucket solves problem #1 cleanly. Token round-trip works by default because the snapshot is a flat jsonb of everything.

**What this spec replaces**: the `setting_seed_*` tables + the import-gm-kit tool. Once this Module System ships, GM Kit v1 is superseded — we'd migrate The Arena's current seed rows into a `modules` row and delete the seed tables in a follow-up migration.

---

## 0. The problem today

Content lives in two mutually exclusive places with no bridge:

| Source | Where | How it reaches a new campaign |
|---|---|---|
| **Hardcoded settings** (District Zero, Chased, Mongrels, Empty) | TypeScript in `lib/setting-npcs.ts`, `lib/setting-pins.ts`, `lib/setting-scenes.ts`, `lib/setting-handouts.ts` | Code deploy + pick setting on campaign create |
| **Per-asset library** (world NPCs, world pins) | `world_npcs`, `map_pins` | One asset at a time, GM-initiated promotion |
| **Your own campaign's NPCs/pins/scenes/handouts/objects** | `campaign_npcs`, `campaign_pins`, `tactical_scenes`, `campaign_notes`, `scene_tokens` | **Nowhere.** Stranded inside your campaign. |

The Arena is a perfect illustration — you've authored encounters, handouts, object tokens, all inside one campaign. No way to hand that to another GM as "pick The Arena when you create a campaign." This spec fixes that.

---

## 1. Terminology

| Term | Definition |
|---|---|
| **Module** | A named, versioned, publishable snapshot of campaign content. The unit of distribution. |
| **Author** | The user who created and owns a module. Usually the GM of the source campaign. May be a Thriver for official modules. |
| **Source campaign** | The campaign whose content is snapshotted into the module. Editing the source doesn't mutate published versions — the Author must re-publish. |
| **Version** | A frozen snapshot of a module at a point in time. Immutable. New versions are published; old versions remain available for campaigns already running on them. |
| **Subscriber campaign** | A campaign created by picking a module. Gets a one-time clone of the module's current version into its own rows. Optionally notified when a newer version ships. |
| **Fork** | A Subscriber GM chooses "start from this module but go my own way" — no upgrade prompts. |
| **Permission tier** | Creator (can author + publish modules) / Licensed GM (can use specific modules) / Player (plays in a subscriber campaign). Default: all registered users can author for free during early access; tiers gate paid/premium modules later. |

---

## 2. Authoring flow (author-centric)

### 2a. Set up a source campaign
The author does what they do today — create a campaign, set up NPCs, pins, tactical scenes, handouts, object tokens, pregens — all through the existing UI. Nothing changes about how content is created.

### 2b. Publish
On the campaign's edit page or a new `/stories/[id]/modules` page, the author sees a **Publish as Module** button. Click → publish wizard:

1. **Module metadata** — name (prefilled from campaign name), tagline, full description, cover image, parent setting (Mongrels / Chased / District Zero / Custom), intended session count, recommended player count, content tags (horror / military / sandbox / one-shot).
2. **What to include** — checkboxes for NPCs, pins, scenes, handouts, object tokens, pregens, communities (Phase 4b dependency). Author can exclude anything they don't want to travel with the module (e.g., playtest NPCs, spoiler pins).
3. **Visibility** — Private (author-only), Unlisted (discoverable by invite link), Listed (discoverable on the module marketplace). Default Private while early.
4. **Preview** — shows a summary: "12 NPCs, 28 pins, 3 tactical scenes, 4 handouts, 7 object tokens."
5. **Publish** — creates version 1 (`semver` style `1.0.0`, or integer versions).

### 2c. Update
Author continues to evolve the source campaign. On Publish:
- **Patch** — silent improvements (typo fixes, minor stat tweaks). Subscribers auto-upgrade.
- **Minor** — new content, non-breaking (added NPC, extra pin). Subscribers prompted to upgrade.
- **Major** — breaking changes (renamed scenes, removed NPCs). Subscribers must opt in.

Author picks semver bump at publish time. Default = minor.

### 2d. Version history
`/stories/[id]/modules/[module_id]/versions` — list all versions with published-at timestamps, subscriber count per version, and a diff summary ("+2 NPCs, -1 pin, 3 handouts updated").

---

## 3. Subscriber flow

### 3a. Browse / pick a module
`/modules` — module marketplace (filtered by setting, tags, rating, subscriber count). Each module card: cover image, name, author, description, setting, session count, recommended players, what's inside.

### 3b. Create a campaign from a module
Existing campaign-creation flow gets a third option alongside Custom and Setting:

- Custom — blank slate.
- Setting — pick one of the hardcoded settings (existing behavior).
- **Module** — pick a published module. The campaign seeds from the module's latest version instead of the setting's TS arrays.

Under the hood: clone the module's snapshotted NPCs/pins/scenes/handouts/objects/pregens into the new campaign's rows. Store `source_module_id` and `source_module_version_id` on the campaign so we know what it came from.

### 3c. Update notifications
When the module's author publishes a new version:
- **Patch**: silently merge (rare). Probably never auto-applied to avoid surprises mid-session.
- **Minor/Major**: notification on the subscriber GM's dashboard. "The Arena 1.2.0 is out — 1 new NPC, 2 handouts updated. [Review] [Apply] [Fork]."
- **Review** — shows the diff: what's new, what's changed in stats, what's removed. GM can cherry-pick.
- **Apply** — merges the new content. Conflicts (author edited a scene the GM also edited locally) surface a resolution step: keep mine / take theirs / manual.
- **Fork** — marks the campaign as forked. No more update prompts.

### 3d. What about "I already edited that NPC"?
Every cloned row gets a `module_source_version_id` and an `edited_since_clone` bool. Upgrades only overwrite un-edited rows by default. Author changes to rows the GM has since modified go into a merge UI.

---

## 4. Permission tiers

| Tier | Can | Cannot |
|---|---|---|
| **Survivor (default)** | Play in any module-based campaign; subscribe to free modules | Publish modules |
| **Author (via opt-in flag)** | Publish unlimited Private/Unlisted modules; Listed publishing during early access | Sell modules |
| **Licensed GM** | Use premium modules for their campaigns (paid tier later) | — |
| **Thriver** | Feature modules in the marketplace; author official modules; moderate reports | — |

Early access: every user is automatically an Author. Tiers and paywalls land later.

---

## 5. Data model

Two options. Starting with **Option A** (jsonb snapshots) for MVP, with a migration path to **Option B** (normalized tables) if the platform scales.

### Option A — jsonb snapshots (MVP)

```
modules
  id uuid PK
  author_user_id uuid → auth.users
  source_campaign_id uuid → campaigns (nullable after author deletes source)
  name text
  tagline text
  description text
  cover_image_url text
  parent_setting text              -- 'mongrels' | 'chased' | 'district_zero' | 'custom'
  setting_slug text                -- matches lib/settings.ts slugs for theming
  content_tags text[]              -- ['horror','one-shot','sandbox']
  session_count_estimate int
  player_count_recommended int
  visibility text                  -- 'private' | 'unlisted' | 'listed'
  created_at timestamptz
  latest_version_id uuid           -- cached pointer to the most recent module_versions row

module_versions
  id uuid PK
  module_id uuid → modules
  version text                     -- '1.0.0', '1.1.0', '2.0.0'
  version_major int
  version_minor int
  version_patch int
  published_at timestamptz
  published_by uuid → auth.users
  changelog text                   -- author-entered notes
  snapshot jsonb NOT NULL          -- { npcs: [...], pins: [...], scenes: [...], handouts: [...], objects: [...], pregens: [...], communities: [...] }
  subscriber_count int DEFAULT 0
  UNIQUE(module_id, version)

module_subscriptions
  id uuid PK
  campaign_id uuid → campaigns
  module_id uuid → modules
  current_version_id uuid → module_versions
  subscribed_at timestamptz
  status text                      -- 'active' | 'forked' | 'unsubscribed'
  UNIQUE(campaign_id, module_id)
```

Snapshot shape (one row, full payload):

```json
{
  "npcs": [{ "external_id": "original_campaign_npc_id", "name": "...", "rapid": {}, "skills": [], ... }],
  "pins": [{ "name": "...", "lat": 0, "lng": 0, "notes": "...", "category": "...", "sort_order": 1 }],
  "scenes": [{ "name": "...", "grid_cols": 20, "grid_rows": 15, "cell_feet": 3, "background_url": "...", "tokens": [...] }],
  "handouts": [{ "title": "...", "content": "...", "attachments": [{ "url": "..." }] }],
  "objects": [{ "name": "...", "portrait_url": "...", "wp_max": 10, "properties": [], "contents": [], "lootable": false }],
  "pregens": [{ "name": "...", "data": { ... } }],
  "communities": [{ "name": "...", "description": "...", "members": [...] }]
}
```

**Pros**: one row per version, dead-simple snapshot + clone, no schema changes when we add a new content type.
**Cons**: can't query "which modules contain Gus González" without a full-table scan. OK for MVP since discovery happens at the module level, not the content-asset level.

**Why jsonb first**: the MVP shipping loop is publish + clone. Neither needs cross-module asset search. We can migrate to normalized tables later without changing the UI.

### Storage

Module cover images, handout attachments, scene backgrounds, object-token art all live in the existing storage buckets. Snapshot references them by URL, so clones keep the same URLs pointing at the same bucket objects. When an author deletes the source campaign, storage objects could orphan — Phase 2 cleanup job garbage-collects.

### RLS sketch
- **modules SELECT**: Author always; anyone when `visibility = 'listed'`; people holding the invite token for `unlisted`.
- **modules INSERT/UPDATE/DELETE**: Author only (or Thriver for moderation).
- **module_versions SELECT**: inherits from modules.
- **module_versions INSERT**: Author only, on their own module.
- **module_subscriptions SELECT/INSERT/UPDATE/DELETE**: the subscriber campaign's GM, scoped to their campaign.

---

## 6. Cloning — the canonical implementation

On campaign creation from a module:

```
function cloneModuleIntoCampaign(moduleVersion, campaign):
  snapshot = moduleVersion.snapshot

  # NPCs — campaign_npcs, preserve relative order via sort_order
  for each npc in snapshot.npcs:
    insert into campaign_npcs with campaign_id = campaign.id,
      copy all fields, assign fresh uuid,
      record module_source_version_id = moduleVersion.id,
      record module_external_id = npc.external_id

  # Pins — same pattern into campaign_pins
  for each pin in snapshot.pins: ...

  # Scenes + their scene_tokens — scenes into tactical_scenes, tokens into scene_tokens
  for each scene in snapshot.scenes:
    scene_row = insert into tactical_scenes ...
    for each token in scene.tokens:
      insert into scene_tokens with scene_id = scene_row.id ...

  # Handouts into campaign_notes (with attachments[] jsonb)
  for each handout in snapshot.handouts: ...

  # Object tokens (rolled up inside scenes above) — no-op here

  # Pregens — a separate pregen_characters table or jsonb on campaigns

  # Communities (if included) — insert into communities + community_members
  for each community in snapshot.communities: ...

  insert into module_subscriptions (campaign_id, module_id, current_version_id, status='active')
```

Single transaction; any failure rolls back the whole clone so the subscriber doesn't end up with a half-seeded campaign.

---

## 7. Integration with existing systems

| Existing | What changes |
|---|---|
| **Settings** (`lib/settings.ts`, `lib/setting-*.ts`) | Settings stay as the base theme/world layer. Modules target a parent setting and extend it. Mongrels/Chased/District Zero remain as hardcoded "getting started" options; modules become the preferred distribution format for everything user-authored. |
| **Pregens** | Already a seed concept. Modules carry their own pregens; the clone inserts them. |
| **world_npcs** (portrait bank → NPC library) | Keep. Orthogonal — it's a library of reusable NPC *templates*, while a module is a packaged *adventure context*. They can coexist. |
| **Communities (Phase 4b)** | Published communities travel as part of a module snapshot. When Phase 4b Phase E lands (world_communities), module-published communities auto-register in the persistent world. |
| **GM Kit Export** (TODO:498) | Output format of "publish module" — the module's snapshot + a printable adventure playbook PDF. Tied to but distinct from the live subscription flow. |
| **Campaign edit page** | New "Module" tab surfaces version history, subscriber count, publish wizard. |

---

## 8. UI surfaces

### 8a. Module authoring

- **Campaign edit page → Module tab** (GM of the campaign only)
  - "Publish as Module" big CTA if no module yet
  - If a module exists: current version, subscriber count, changelog history, "Publish New Version" button, "Unpublish" (marks latest version as archived).
- **Publish wizard** — 5-step flow per §2b.
- **Version diff view** — side-by-side showing what changed since the last published version so the author knows what subscribers will see.

### 8b. Module marketplace

- `/modules` — grid layout, filters (setting, tags, rating), search.
- `/modules/[id]` — module detail: cover, description, author, version history, reviews (Phase 3), "Subscribe / Create Campaign" button.

### 8c. Subscriber campaign

- New campaign-creation flow: Custom / Setting / **Module** tab picker.
- Campaign edit page shows "Subscribed to **The Arena** v1.2.0" + update badge when newer versions ship.
- **Update review modal** — the diff with accept/reject per asset, fork option, conflict resolver.

### 8d. Thriver moderation

- `/moderate/modules` — flagged modules, review queue for Listed visibility (new listings go through Thriver approval for quality floor early on).

---

## 9. Rollout phases

### Phase A — MVP (author → publish → subscribe → clone)
- `modules` + `module_versions` + `module_subscriptions` tables with jsonb snapshots
- Campaign edit page: **Publish as Module** button with snapshot wizard
- Campaign creation: **Module** picker + clone logic
- Single-version flow (no version history UI yet — always clone latest)
- RLS policies: Author can publish, anyone can use Listed; Unlisted via invite token; Private stays put

### Phase B — Versioning + updates
- Semver bump on publish (major / minor / patch)
- `/stories/[id]/modules/[id]/versions` history UI
- Update notifications on subscriber dashboards
- Review modal with accept/reject diff
- `edited_since_clone` tracking per cloned row so updates skip customized assets

### Phase C — Marketplace
- `/modules` browse + search + filters
- Module detail page with ratings + reviews
- Listed publishing moderation queue (Thriver)
- Cover image upload + featured-module surface on dashboard

### Phase D — Monetization + tiers
- Free / Paid / Premium module pricing
- Licensed GM permission (unlocks paid modules)
- Author payout flow
- Referral tracking

### Phase E — Ecosystem + integrations
- GM Kit Export = printable PDF of a module snapshot + playbook
- Module + Community cross-publish (communities travel with modules; Phase 4b dependency)
- Third-party import (Roll20, Foundry module → Tapestry module conversion — stretch)
- Versioned asset types (an NPC template in world_npcs can be referenced by multiple modules at pinned versions)

---

## 10. Out of scope (non-goals)

- **Collaborative multi-author editing** of a single module. One author per module in MVP. Co-author adds in Phase D.
- **Live sync** — once a campaign clones a module version, edits in the source do not propagate live. Only explicit publish + subscriber-approved updates do. This is a feature, not a bug (GMs don't want their live sessions mutated mid-play).
- **Procedural content generation** — every module is authored, never auto-generated.
- **Exposing raw asset libraries across modules** — Phase E idea. Start with self-contained snapshots.

---

## 11. Open questions (decide before building Phase A)

1. **Versioning format**: semver (1.0.0, 1.1.0) or integer (v1, v2, v3)? Semver signals stability to GMs but is overkill for single-author content.
2. **Snapshot storage**: jsonb (proposed) or normalized tables? MVP = jsonb. Revisit if cross-module asset search becomes a product need.
3. **Authoring inside the source campaign vs. a dedicated module editor**: source-campaign-as-authoring-surface (proposed) — dogfoods the GM tools. Dedicated editor adds friction.
4. **Handling source-campaign deletion**: module keeps working (the snapshot is self-contained), but no future versions possible. Surface a "source campaign deleted — this module is archived" chip.
5. **Pregens inside vs alongside modules**: pregens are campaign-scoped today. Extend to modules so cloned campaigns get the pregens automatically. Requires a shared pregen data model (probably jsonb on the module snapshot — matches the rest).
6. **Updates to shared storage assets**: if an author updates a handout image in their source campaign, should already-subscribed campaigns see the new image? No — snapshot URLs freeze to what was current at publish time. Authors who want updates re-publish.
7. **Naming**: "Module," "Adventure," "Package"? The roadmap uses "Module" — sticking with it unless the author-user-base pushes back.

---

## 12. Why this is the differentiator

No other TTRPG platform lets a GM set up an adventure inside the live tool — NPCs with portraits, scenes with actual battle maps, handouts with images, object tokens with loot tables — and ship it to other GMs as a one-click install. The closest precedents (Roll20 modules, Foundry modules) are author-offline, install-from-ZIP affairs. The Tapestry's edge is **everything you can do as a GM is authoring**. When you hit publish, that entire context travels intact.

Pairs with Communities (spec-communities.md) the way D&D's adventure paths pair with faction play: adventure content provides the arc, communities provide the persistent social layer. A single published module can ship both — walking into another GM's campaign already populated with NPCs, scenes, *and* a budding community they can grow.
