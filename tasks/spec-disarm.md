# DISARM Combat Action - Implementation Spec

**Confirmed:** 2026-06-23 (Xero)
**Lane:** Hunt & Peck
**Primary file:** `app/stories/[id]/table/page.tsx`
**Reference implementation:** Grapple modal (`showGrappleModal` IIFE, line ~8953)

---

## 1. Action Button

### Location
Normal combat action bar (same row as Grapple, Attack, etc.). Not shown during `isGrappled` or `isGrappling` states.

### Label
`Disarm`

### Gate conditions
- In combat (initiative running) - same requirement as all other combat actions
- `actions_remaining >= 1` for the active combatant
- Target must be within 5 ft (Chebyshev distance check via `mapTokens`, identical to Grapple's range gate). Disarm is melee-range only.
- Target must have a weapon equipped (has a `primary_weapon` that is not null). Button is disabled / greyed if no valid in-range target has an equipped weapon. Exact check: at least one `engagedTargets` entry (distance <= 1 cell at 5 ft/cell) whose character or NPC has a non-null equipped primary weapon.

### onClick
```tsx
onClick={() => { setDisarmResult(null); setShowDisarmModal(true); }}
```
State: `showDisarmModal: boolean`, `disarmResult: DisarmResult | null` (new state vars).

---

## 2. Modal Design

Model the modal after `showGrappleModal`. Build it as an IIFE inside the return block assigned to `showDisarmModal`.

### Shell
Use `<RollModal>` with:
- `title="Disarm"`
- `amod={aPhyMod}` -- attacker's PHY modifier (`rapid.PHY`)
- `smod={aSkillLevel}` -- computed from attacker's chosen skill (see section 3)
- `cmod` / `setCmod` -- standard CMod state
- `preRollExtras` -- custom UI slot (target picker + skill selector)
- `renderOutcome` -- outcome display after roll

### `preRollExtras` contents (pre-roll UI)

**Target picker** (same pattern as Grapple):
- Label: "Target"
- Dropdown listing `engagedTargets` (tokens within 5 ft that have an equipped primary weapon)
- State: `disarmTargetId: string | null`
- If no valid targets: show "No armed targets within reach" and disable Roll button

**Attacker skill selector**:
- Label: "Your skill"
- Two-option radio or `<select>`:
  - `Unarmed Combat` (PHY-based; grapple the weapon away)
  - `Athletics` (PHY-based; brute-force strip)
- State: `disarmAttackerSkill: 'Unarmed Combat' | 'Athletics'`
- Default: `'Unarmed Combat'`
- Both skills are PHY-based, so `amod` does not change between choices - only `smod` changes.

```ts
const amod = rapid.PHY  // always PHY regardless of Unarmed vs Athletics
const aSkillLevel = activeChar?.skills?.find(s => s.skillName === disarmAttackerSkill)?.level ?? 0
```

**CMod field**: standard CMod row (already in RollModal shell).

**Insight Dice**: standard -- same `preRollInsight` / `setPreRollInsight` wiring used in Grapple.

---

## 3. Opposed Check Mechanics

### Attacker roll
```
aTotal = die1 + die2 + amod + aSkillLevel + totalCmod
```
- `die1`, `die2`: 2d6 standard (or Insight variant)
- `amod`: always PHY (both Unarmed Combat and Athletics are PHY-based)
- `aSkillLevel`: level of chosen skill
- `totalCmod`: CMod field value + any Insight +3 bonus

### Defender roll
Defender uses the **better of** Unarmed Combat (PHY) or Athletics (PHY) -- the same pool as the attacker's choices, matching the "both sides" language in the canon spec.

```ts
const dPhyMod  = dRapid.PHY
const dUnarmed = defenderChar?.skills?.find(s => s.skillName === 'Unarmed Combat')?.level ?? 0
const dAthle   = defenderChar?.skills?.find(s => s.skillName === 'Athletics')?.level ?? 0
const dSmod    = Math.max(dUnarmed, dAthle)
const dTotal   = dDie1 + dDie2 + dPhyMod + dSmod
```

- Defender does NOT choose; best-of is automatic (same as Grapple's defender logic).
- Defender's dice are rolled client-side (same as Grapple: `Math.ceil(Math.random()*6)` x2).
- Defender gets no CMod, no Insight.

### Winner determination
Use the existing `outcomeTier()` helper:
```ts
const aTier = outcomeTier(aOutcome)  // outcome from RollModal result
const dTier = outcomeTier(dOutcome)  // derived from dTotal
const attackerWins = aTier > dTier
const tie = aTier === dTier
```

---

## 4. On Attacker Win

Execute in `executeDisarm()` (async function, called from `renderOutcome` confirm button):

### Step A: Identify defender's equipped weapon
```ts
// For a PC defender:
const defWeapon = defenderChar.primary_weapon  // the equipped primary weapon object
// For an NPC defender:
const defWeapon = defenderNpc.primary_weapon
```
Capture `defWeapon.name` and `defWeapon.portrait_url` (or a default weapon icon) before clearing.

### Step B: Drop weapon as map token
Insert a new row into `scene_tokens`:
```ts
await supabase.from('scene_tokens').insert({
  scene_id: activeScene.id,
  name: defWeapon.name ?? 'Dropped Weapon',
  token_type: 'object',
  grid_x: tTok.grid_x,   // defender's current grid position
  grid_y: tTok.grid_y,
  is_visible: true,
  portrait_url: defWeapon.portrait_url ?? null,
  wp_max: 0,
  wp_current: 0,
  properties: [],
  contents: [],
  is_door: false,
  is_wall: false,
  is_window: false,
})
```
`tTok` = `mapTokens.find(...)` for the defender (same lookup pattern as Grapple uses for distance checks).

After insert, call `loadScene(activeScene.id)` (or the equivalent map-token reload) so the token appears immediately on the map.

### Step C: Unequip defender's weapon
For a PC defender:
```ts
await supabase
  .from('characters')
  .update({ primary_weapon: null })
  .eq('id', defenderChar.id)
```
For an NPC defender:
```ts
await supabase
  .from('npcs')
  .update({ primary_weapon: null })
  .eq('id', defenderNpc.id)
```
Then reload the character/NPC state via the existing refresh pattern.

### Step D: Consume attacker's action
```ts
await consumeAction(active.id, `Disarm - ${defWeapon.name ?? 'weapon'} dropped`)
```
The `actionLabel` string appears in the roll feed via `consumeAction`'s built-in `insertRollLog` call.

### Step E: Roll log entry
Call `insertRollLog` for the attacker's roll (same fields as Grapple):
```ts
await insertRollLog({
  campaign_id: campaignId,
  character_id: activeEntry.character_id ?? null,
  npc_id: activeEntry.npc_id ?? null,
  roll_type: 'disarm',
  skill_name: disarmAttackerSkill,
  die1: result.die1,
  die2: result.die2,
  amod: amod,
  smod: aSkillLevel,
  cmod: totalCmod,
  total: result.total,
  outcome: result.outcome,
  narrative: `Disarmed ${defenderName} -- ${defWeapon.name ?? 'weapon'} dropped at their feet`,
})
```

---

## 5. On Defender Win or Tie

- No state change (no weapon drops, no unequip).
- Attacker still **loses 1 action** (`consumeAction` is called regardless of outcome -- the action was spent attempting the Disarm).
- Roll log entry still written (outcome reflects the loss).
- Narrative for defender win: `"Disarm attempt failed -- ${defenderName} kept hold of their ${defWeapon.name ?? 'weapon'}"`
- Tie resolves as defender win (no_victor = defender keeps weapon; same logic as Grapple's `no_victor` branch).

---

## 6. Dropped Weapon Token Details

The `scene_tokens` insert above creates a standard object token. No new `token_type` enum value is needed -- `'object'` covers it. The token is indistinguishable from any other object the GM places; any combatant can interact with it via the existing map UI.

No metadata linking the token back to the original weapon item is stored (the token is just a named object on the map). This is intentional -- keeping it simple; the GM can manually give the item back to a character if needed via inventory.

---

## 7. Pick Up Mechanic

Picking up the dropped weapon token is **not automatic**. It requires the picking-up combatant to use their **Ready Weapon** action:

1. The dropped weapon appears as an object token on the map at the defender's cell.
2. Any combatant in the same cell (or adjacent, per GM ruling) may use **Ready Weapon** on their turn.
3. Inside the existing `showReadyWeaponModal`, the "Equip from Inventory" sub-action is used if the weapon is tracked in inventory. For ad-hoc pickup (weapon not in picker's inventory), the GM uses the standard inventory UI to add the item, then the combatant uses Ready Weapon to equip it.

No new "pick up" action is needed. The existing Ready Weapon + Equip flow covers it.

The object token should be manually deleted by the GM once the weapon is picked up (or auto-cleared at scene end via existing scene cleanup). No automated token deletion is implemented in Phase 1.

---

## 8. READY Weapon Mechanic

Covered by the existing `showReadyWeaponModal` flow -- no changes required. The "Equip from Inventory" sub-action inside Ready Weapon is the correct path for arming with a picked-up weapon.

Cost: 1 action (already enforced by `consumeAction` inside Ready Weapon paths).

---

## 9. Roll Feed Output

Two entries in the feed per Disarm attempt:

**Entry 1** -- from `insertRollLog`:
```
[Character Name] attempts to Disarm [Target Name]
Roll: [die1]+[die2] + [amod] PHY/DEX + [smod] [Skill] + [cmod] CMod = [total] ([Outcome])
```
Exact format follows the existing `roll_type`-keyed narrative renderer in the roll feed. Add `'disarm'` as a handled `roll_type` in the feed renderer with the narrative pattern above.

**Entry 2** -- from `consumeAction`'s built-in log:
```
[Character Name] used Disarm - [weapon name] dropped   (on win)
[Character Name] used Disarm - attempt failed           (on loss/tie)
```

The defender's opposed roll is shown only in the modal's `renderOutcome` (not persisted), matching Grapple's behavior.

---

## 10. RPC vs Client-Side

**Client-side only** -- no new Supabase RPC. The three DB writes (insert scene_token, update character/npc primary_weapon, consumeAction) are sequential awaits in `executeDisarm()`, following the same pattern as `executeGrapple`. No transaction wrapper is needed; failure at any step leaves a recoverable state (worst case: weapon token exists but character still shows weapon equipped -- GM can resolve manually).

If atomic guarantees become necessary in a future pass, wrap in an RPC. Not required for Phase 1.

---

## 11. Code Location and Modeling Pattern

### State vars to add (near existing Grapple state, around line ~500)
```ts
const [showDisarmModal, setShowDisarmModal] = useState(false)
const [disarmResult, setDisarmResult] = useState<DisarmResult | null>(null)
const [disarmTargetId, setDisarmTargetId] = useState<string | null>(null)
const [disarmAttackerSkill, setDisarmAttackerSkill] = useState<'Unarmed Combat' | 'Athletics'>('Unarmed Combat')
const [disarmCmod, setDisarmCmod] = useState(0)
const [disarmInsight, setDisarmInsight] = useState<PreRollChoice>(null)
```

### `executeDisarm` function
Defined inside the `showDisarmModal` IIFE (mirror the structure of `executeGrapple` inside `showGrappleModal`).

### IIFE location
Insert the `showDisarmModal &&` block in the return JSX immediately after `showGrappleModal &&` block (around line ~9171).

### Button location
In the normal action bar JSX (around line ~6221, where Grapple button lives). Insert Disarm button adjacent to Grapple:
```tsx
{/* Disarm */}
{hasValidDisarmTargets && (
  <button
    className="action-btn"
    onClick={() => { setDisarmResult(null); setShowDisarmModal(true); }}
  >
    Disarm
  </button>
)}
```
Where `hasValidDisarmTargets` is a derived boolean (computed inline or memoized):
```ts
const hasValidDisarmTargets = engagedTargets.some(t => {
  const tok = mapTokens.find(m => m.id === t.tokenId)
  // check distance <= 1 cell
  if (!tok) return false
  const dist = Math.max(Math.abs(aTok.grid_x - tok.grid_x), Math.abs(aTok.grid_y - tok.grid_y))
  if (dist > 1) return false
  // check target has equipped weapon
  const char = characters.find(c => c.id === tok.character_id)
  const npc  = npcs.find(n => n.id === tok.npc_id)
  return !!(char?.primary_weapon || npc?.primary_weapon)
})
```

### `DisarmResult` type (add near other local types)
```ts
type DisarmResult = {
  attackerTotal: number
  defenderTotal: number
  attackerOutcome: string
  defenderOutcome: string
  attackerWins: boolean
  tie: boolean
  defenderName: string
  weaponName: string
}
```

---

## Out of Scope (Phase 1)

- Two-handed weapon Disarm requiring two hands free (not tracked in current schema)
- Disarming a secondary/offhand weapon (primary_weapon only)
- Attacker picking up the dropped weapon without spending Ready Weapon action
- Auto-removing the object token when picked up
- Range gate for ranged-weapon Disarm (e.g. using a whip) -- melee range only
- Defender counter-Disarm on a critical fail by attacker
