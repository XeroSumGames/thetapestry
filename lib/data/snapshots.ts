import { db } from './db'
import type { CampaignSnapshot } from '../campaign-snapshot'

export function deleteCampaignSnapshot(snapshotId: string) {
  return db().from('campaign_snapshots').delete().eq('id', snapshotId)
}

/** Persist a captured snapshot to campaign_snapshots. */
export function insertCampaignSnapshot(
  campaignId: string,
  name: string,
  snapshot: CampaignSnapshot,
  userId: string | null,
  includesCharacterStates: boolean,
) {
  return db().from('campaign_snapshots').insert({
    campaign_id: campaignId,
    name,
    snapshot: snapshot as any,
    includes_character_states: includesCharacterStates,
    created_by: userId,
  })
}
