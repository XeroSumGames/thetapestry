// Canonical row shapes for the `communities` and `community_members`
// tables. Pre-extraction these were redefined verbatim (with subtly
// different field subsets) in CampaignCommunity, CommunityMoraleModal,
// and the Community Dashboard page — drift hazard since each migration
// to the SQL had to chase three TS interfaces.
//
// Source of truth: sql/communities-phase-a.sql plus the migrations under
// sql/community-members-add-*.sql and sql/community-*.sql. Whenever those
// land a new column, update this file too.
//
// Consumers usually only read a subset of the fields; TypeScript's
// excess-property checks aren't a problem here because we're typing
// rows that come back from the DB (where extra fields are normal). If
// a consumer needs a narrower shape it can `Pick<Community, ...>`.

export type CommunityStatus = 'forming' | 'active' | 'dissolved'

export type Role =
  | 'gatherer'
  | 'maintainer'
  | 'safety'
  | 'unassigned'
  | 'assigned'

export type RecruitmentType =
  | 'cohort'
  | 'conscript'
  | 'convert'
  | 'apprentice'
  | 'founder'
  | 'member'

export type MemberStatus = 'pending' | 'active' | 'removed'

export type LeftReason =
  | 'morale_25'
  | 'morale_50'
  | 'dissolved'
  | 'manual'
  | 'killed'

export type WorldVisibility = 'private' | 'published'

// communities table — full DB shape (Phase A + Phase E columns).
export interface Community {
  id: string
  campaign_id: string
  name: string
  description: string | null
  homestead_pin_id: string | null
  status: CommunityStatus
  leader_npc_id: string | null
  leader_user_id: string | null
  consecutive_failures: number
  week_number: number
  created_at: string
  dissolved_at: string | null
  // Phase E persistent-world layer.
  published_at: string | null
  world_visibility: WorldVisibility
  world_community_id: string | null
}

// community_members table — full DB shape (Phase A + accumulated migrations).
export interface Member {
  id: string
  community_id: string
  npc_id: string | null
  character_id: string | null
  role: Role
  recruitment_type: RecruitmentType
  apprentice_of_character_id: string | null
  joined_at: string
  left_at: string | null
  left_reason: LeftReason | null
  // Phase D add-ons.
  status: MemberStatus
  invited_by_user_id: string | null
  current_task: string | null
  assignment_pc_id: string | null
}
