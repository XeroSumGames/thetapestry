# `/welcome` copy — what changed (original → current)

The `/welcome` page started with my original copy in commit `61b8fa3` (2026-04-28 redesign as "A Guide to the Tapestry"). You then rewrote most of it across two passes (`d6fba54`, `1392483`, plus this session's edit). This is a side-by-side so nothing valuable is lost — pull lines back from the **Original** column whenever the rewrite drops something you wanted.

If you want any of the originals restored, point at the section + I'll patch them in.

## Hero — page title

| Slot | Original (`61b8fa3`) | Current |
|---|---|---|
| H1 | "A Guide to the Tapestry" | "A Guide to using the Tapestry" |
| Subtitle | "Come back here whenever you need a refresher on what lives where. Each section below points to a part of the platform, with a short note on what it's for and how to get the most out of it." | "This page provides a refresher on where to find what. Each section below points to a part of the platform, with a short note on what it's for and how to get the most out of it." |

**Lost:** "Come back here whenever you need a refresher" was warmer / more personal than "This page provides a refresher".

## Section heading above the destinations grid

| | Value |
|---|---|
| Original | `THE TAPESTRY` (small red eyebrow above the 6-card grid) |
| Current | (no heading — grid sits flush under the hero) |

**Lost:** the "THE TAPESTRY" eyebrow as a section anchor. You removed it intentionally; flag for the record.

## Destination cards (6 — original / 5 + Rumors below Campfire — current)

### The World

| Original | Current |
|---|---|
| The interactive map of the post-flu world. **Drop pins, file Rumors, and watch what other survivors are reporting. Substantiated Rumors shape the canon over time.** | This interactive map of the post-dog flu world allows you to drop pins for yourself or others, report rumors, and see what other survivors are reporting. Substantiated rumors shape the canon over time and are reflected here, on the world map. |

**Lost:** "post-flu" → "post-dog flu" (deliberate flavor); "Drop pins, file Rumors" punchy three-verb cadence is gone in favor of a longer sentence.

### My Survivors

| Original | Current |
|---|---|
| **Your roster of characters. Build new ones via Backstory Generation, the Quick Character Generator, or the Random Character path. Sheets, gear, and history all live here.** | Your roster of characters. Here you can create new ones via the Backstory Generation process that guides you through every step of your characters life before the pandemic, the Quick Character Generator for those that know the system and have a concept in mind, or pick a completely Random Character. |

**Lost:** "Sheets, gear, and history all live here." — a nice closer that pointed at what's INSIDE this destination beyond just creation.

### My Stories

| Original | Current |
|---|---|
| Campaigns and one-shots you're part of, as a player or GM. **The story table, scenes, and session history all hang off of a Story.** | Whether it is as a player or GM, here is where you can find the various campaigns and one-shots you're part of. This is where you launch The Table, where stories are told. |

**Lost:** "The story table, scenes, and session history all hang off of a Story" — that sentence taught readers the data model in a way the new copy doesn't.

### My Communities

| Original | Current |
|---|---|
| Communities are persistent groups of survivors who share a base, resources, and Morale. **Recruit, lose, and grow them across sessions — XSE §08 Community drives the rules.** | Communities are persistent groups of survivors who share a base and resources. Recruit NPCs to your side as cohorts, conscripts, or converts as you grow across sessions, leaving an indelible mark on this persistent world. |

**Lost:** "share a base, resources, and **Morale**" (Morale dropped). The "XSE §08 Community drives the rules" rule citation was removed (consistent with the SRD-wording sweep direction). Tradeoff: the new copy adds the cohort/conscript/convert vocabulary which is good.

### Modules → Rumors

| Original ("Modules") | Current ("Rumors") |
|---|---|
| **Pre-built scenes, NPCs, items, and storylines you can subscribe to and import into your own campaigns. Authors snapshot their content; you pull versioned copies.** | Pre-built scenes, encounters, adventures and campaigns that include NPCs, items, and storylines that you can subscribe to and import to play with your own group. Authors snapshot their content; GMs pull versioned copies. |

**Lost (and dangling):** the card title is now **"Rumors"** but the body still describes Modules and the button still says "Browse Modules". Pick a direction:
- (A) Keep title "Rumors" + retune body to use rumor framing ("Hear what other GMs are running…") + button "Hear Rumors"
- (B) Revert title to "Modules" — the body and button already match
- (C) Keep both (current state) and accept the framing inconsistency

### The Campfire

| Original | Current |
|---|---|
| The **town notice board** for the Tapestry — Looking-for-Group posts, Rumors from the world map, War Stories, and world events. *(In progress.)* | The heart of the Tapestry, here players can find groups and GMs can find players. Built-in Looking-for-Group tools, Messaging, Forums, player-reported War Stories, and both rumors and confirmed world events. *(In progress.)* |

**Lost:** "town notice board" was a strong setting-fit metaphor. New copy is more prosaic but more functional.

## Building a Survivor — card copy

### Backstory Generation

| Original | Current |
|---|---|
| **Spend CDP across the chapters of your survivor's life — the rich path. Best for first survivors.** | Recommended for first time survivors, the Background Generation process allows you to spend Character Development Points during the different stages of your survivor's life to craft a character that directly matches your vision. |

**Lost:** "the rich path" (a nice qualitative pitch). New version expands "CDP" → "Character Development Points" (clearer for newcomers).

### Quick Character

| Original | Current |
|---|---|
| **Skip the chapters. Spend a flat 20 CDP and customize directly. For experienced players.** | Recommended for experienced users, this option lets you spend 20 CDP on attributes and skills and directly customize your character. |

**Lost:** "Skip the chapters." — a punchy lead that signaled the contrast with Backstory Generation. The new copy doesn't connect to the Backstory framing.

### Random Character

(Unchanged: "Roll up a survivor on the fly. Great for NPCs or table emergencies.")

### Creating a Survivor

(Unchanged: "The full guide — how Character Development Points (CDP), chapters, and trait acquisition work.")

## Quick Reference card

| Original | Current |
|---|---|
| Cheat sheets and rules excerpts will live here — common terms (CDP, WP, RP, Stress, Inspiration), house rules, and links into **the SRD & Distemper CRB**. Tell me what you want surfaced first and I'll wire it in. | Cheat sheets and rules excerpts will live here — common terms (CDP, WP, RP, Stress, Inspiration), house rules, and links into **the Distemper Core Rulebook and the Xero Sum Engine SRD**. Tell me what you want surfaced first and I'll wire it in. |

**Lost:** the brevity of "SRD & Distemper CRB" — the new "Distemper Core Rulebook and the Xero Sum Engine SRD" is more discoverable but verbose. (You may want this to match the SRD-wording-sweep TODO that wants "the rules" in user-visible copy.)

## Layout / structural changes (this session)

- "Modules" card moved from position 5 to position 6 (after Campfire) and renamed "Rumors" with the body unchanged.
- "Building a Survivor" grid split: "Creating a Survivor" now occupies its own row, the three creation paths (Backstory / Quick / Random) share the row below.
- "Off-Platform" links now centred horizontally + section heading also centred.

## Recommendation

If you want a **fast partial restore**, the lines I'd grab back first:
1. **Hero subtitle:** "Come back here whenever you need a refresher on what lives where…"
2. **My Survivors closer:** "Sheets, gear, and history all live here."
3. **My Stories closer:** "The story table, scenes, and session history all hang off of a Story."
4. **Campfire framing:** "town notice board for the Tapestry"
5. **Quick Character lead:** "Skip the chapters."

Tell me which you want and I'll patch a single edit.
