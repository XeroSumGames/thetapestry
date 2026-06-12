# Finding - "New Community" form hardcodes current player as leader; no NPC-leader option

**Lane:** routed to **Hunt & Peck**.
**Reporter:** Xero 2026-06-12, hit while trying to run dry-run section
1B: "how to start a second community? it auto fills with current
player details. i should be able to start an NPC led community."

## What's broken

The "+ New Community" form at
[components/CampaignCommunity.tsx:1307-1351](components/CampaignCommunity.tsx:1307)
`handleCreate()`:

```ts
const { data, error } = await insertCommunity({
  campaign_id: campaignId,
  name: newName.trim(),
  description: newDesc.trim() || null,
  homestead_pin_id: newHomestead || null,
  leader_user_id: user?.id ?? null,    // <-- always the current user
}).select().single()
```

And immediately after (`:1325-1345`), the creator's PC gets
auto-enrolled as the founding member:

```ts
if (user?.id) {
  const { data: myCm } = await myFoundingCharacter(campaignId, user.id)
  const myCharacterId = (myCm as any)?.character_id as string | undefined
  if (myCharacterId) {
    await insertMembers({
      community_id: newComm.id,
      character_id: myCharacterId,
      role: 'unassigned',
      recruitment_type: 'founder',
      joined_at: ...
    })
  }
}
```

So every new community ends up with the current user as leader AND
the current user's PC as the founding member. No path through the UI
to start an NPC-led community even though the data layer fully
supports it.

## Data layer is ready

Schema (verified in live DB):
- `communities.leader_user_id` (uuid, nullable)
- `communities.leader_npc_id` (uuid, nullable)

The "exactly one" constraint between the two is enforced by code, not
the schema. Evidence:
- `transferLeadership` at `:1253-1256` sets both to null, then sets
  one. Proves both can be cleared independently.
- Read path at `:1243-1244` checks `leader_npc_id` OR `leader_user_id`
  separately - both surfaces are first-class.
- `app/stories/[id]/table/page.tsx:625-636` already reads
  `leader_npc_id` from a community + fetches the NPC's skills for
  recruitment CMod purposes. Proves NPC-led communities are a live
  expected state elsewhere.

So the back-end + read paths are READY. The bug is purely in the
create form's UI.

## Fix shape

Add a "Leader" radio / select to the create form (currently 3 fields:
Name, Description, Homestead). New control with 3 options:

**Option A: "I'll lead it" (current default)** - same as today:
`leader_user_id = user.id`, auto-enroll creator's PC as founder.

**Option B: "An NPC will lead it"** - show an NPC picker dropdown
populated from this campaign's NPCs (`campaign_npcs` filtered by
campaign_id, alive, name-sorted). On submit:
- `leader_npc_id = pickedNpcId`
- `leader_user_id = null`
- Skip the auto-enroll-creator's-PC block - this is an NPC community,
  the player isn't a member.

**Option C: "No leader (will assign later)"** - existing null path:
- `leader_npc_id = null`
- `leader_user_id = null`
- Skip auto-enroll.

Recommend Option A as default to preserve the current behavior. The
existing `+ New Community` button + form layout at `:1612-1635` just
gets one extra row inserted before the submit button.

## UI surface to extend

The current form (`:1618-1635`):
```tsx
{showCreate && (
  <div>
    <input value={newName} onChange={...} placeholder="Community name" />
    <input value={newDesc} onChange={...} placeholder="Description" />
    <input value={newHomestead} onChange={...} placeholder="Homestead pin" />
    <Button onClick={handleCreate}>Create</Button>
  </div>
)}
```

Insert:
```tsx
<div>
  <label>
    <input type="radio" name="leaderKind" value="self"
           checked={leaderKind === 'self'} onChange={...} />
    I'll lead it
  </label>
  <label>
    <input type="radio" name="leaderKind" value="npc"
           checked={leaderKind === 'npc'} onChange={...} />
    An NPC will lead it
  </label>
  <label>
    <input type="radio" name="leaderKind" value="none"
           checked={leaderKind === 'none'} onChange={...} />
    No leader yet
  </label>
  {leaderKind === 'npc' && (
    <select value={leaderNpcId} onChange={...}>
      <option value="">- pick an NPC -</option>
      {campaignNpcs.filter(n => (n.wp_current ?? n.wp_max ?? 1) > 0).map(n => (
        <option key={n.id} value={n.id}>{n.name}</option>
      ))}
    </select>
  )}
</div>
```

`handleCreate` becomes a switch on `leaderKind`:
```ts
async function handleCreate() {
  if (!newName.trim()) return
  if (leaderKind === 'npc' && !leaderNpcId) {
    alert('Pick an NPC leader or change the leader option.')
    return
  }
  setCreating(true)
  const { user } = await getCachedAuth()
  const payload = {
    campaign_id: campaignId,
    name: newName.trim(),
    description: newDesc.trim() || null,
    homestead_pin_id: newHomestead || null,
    leader_user_id: leaderKind === 'self' ? (user?.id ?? null) : null,
    leader_npc_id: leaderKind === 'npc' ? leaderNpcId : null,
  }
  const { data, error } = await insertCommunity(payload).select().single()
  ...
  // Auto-enroll only when leaderKind === 'self'
  if (leaderKind === 'self' && user?.id) {
    ...existing auto-enroll block...
  }
  ...
}
```

`campaignNpcs` is already loaded elsewhere in the file (used for the
trade target lookup at `app/stories/[id]/table/page.tsx:625`); HP can
hoist that fetch or add a parallel one if it doesn't already exist in
CampaignCommunity.tsx's data context.

## Acceptance

- Creating a community with "I'll lead it" produces the same result
  as today (player is leader, player's PC is founder).
- Creating with "An NPC will lead it" + an NPC picked:
  - `communities.leader_npc_id` = the picked NPC's id
  - `communities.leader_user_id` = null
  - No founding-member row gets inserted for the creator's PC
  - The community shows up in the roster with the NPC as leader
- Creating with "No leader yet": both leader_*id fields null, no
  auto-enroll.
- The trade-target community-leader lookup at table page :625-636
  still works against NPC-led communities (already wired - just
  verify it lights up for the new flow).
- Build + 873 unit tests + font/role/em-dash/arch all green.

## Tracking

Append to todo.md PLAYTEST POLISH ROUTES:

```
- [ ] **[ROUTED -> HUNT & PECK 2026-06-12] "New Community" form hardcodes current player as leader - add NPC-led option** - `components/CampaignCommunity.tsx:1307-1351` handleCreate forces `leader_user_id = user.id` + auto-enrolls creator's PC as founder. No path to create an NPC-led community even though data layer fully supports it (`communities.leader_npc_id` column live + read paths wired). Fix: add radio (I'll lead / NPC will lead / No leader yet) to the create form; NPC option shows an NPC picker; auto-enroll only fires for the I'll-lead path. Finding: `tasks/finding-npc-led-community-creation-2026-06-12.md`. **Trigger:** Xero 2026-06-12 while attempting dry-run section 1B: "how to start a second community? it auto fills with current player details. i should be able to start an NPC led community."
```
