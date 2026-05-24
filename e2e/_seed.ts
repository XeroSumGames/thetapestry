import type { Page } from '@playwright/test'
import { SUPABASE_URL, type SupaCreds } from './_teardown'

// Fixture seeding for Gate 0 (phase7 A-F) - all via the acting account's own
// Supabase session (RLS backstop). Seeds go into THE ARENA (disposable) and are
// torn down after the run. See tasks/gate0-build-brief-2026-05-24.md for shapes.

async function authHeaders(creds: SupaCreds, extra: Record<string, string> = {}) {
  return { apikey: creds.anonKey, Authorization: `Bearer ${creds.accessToken}`, ...extra }
}

async function restInsert(page: Page, table: string, row: object, creds: SupaCreds): Promise<any> {
  const res = await page.request.post(`${SUPABASE_URL}/rest/v1/${table}`, {
    headers: await authHeaders(creds, { 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    data: row,
  })
  if (!res.ok()) throw new Error(`insert ${table} -> ${res.status()}: ${await res.text()}`)
  const rows = await res.json()
  return Array.isArray(rows) ? rows[0] : rows
}

export async function rpcCall(page: Page, fn: string, args: object, creds: SupaCreds): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    headers: await authHeaders(creds, { 'Content-Type': 'application/json' }),
    data: args,
  })
  return { ok: res.ok(), status: res.status(), body: await res.text() }
}

// --- Community + stockpile (Section D) ---
export async function seedCommunity(page: Page, creds: SupaCreds, campaignId: string, name: string): Promise<string> {
  const row = await restInsert(page, 'communities', { campaign_id: campaignId, name }, creds)
  return row.id as string
}

export async function seedStockpileItem(page: Page, creds: SupaCreds, communityId: string, name: string, qty = 1): Promise<string> {
  const row = await restInsert(page, 'community_stockpile_items', { community_id: communityId, name, qty }, creds)
  return row.id as string
}

// --- Vehicle (Section B): campaigns.vehicles JSONB via RPC; restore on teardown ---
export function testVehicle(id: string): Record<string, unknown> {
  return {
    id, name: '[E2E] Test Rig', type: 'Truck', rarity: 'Common',
    size: 4, speed: 3, passengers: 4, encumbrance: 80, range: '400 (140/80)',
    wp_max: 50, wp_current: 50, stress: 0, fuel_max: 4, fuel_current: 4,
    three_words: 'Test Test Test', notes: '', image_url: null,
    mounted_weapons: [{ name: 'M60 (Mounted)', notes: 'Fires forward in a 90 degree arc only.' }],
    cargo: [{ name: 'Ammo', qty: 10, notes: '' }],
  }
}

export async function captureVehicles(page: Page, creds: SupaCreds, campaignId: string): Promise<unknown[]> {
  const res = await page.request.get(`${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}&select=vehicles`, { headers: await authHeaders(creds) })
  if (!res.ok()) return []
  const rows = await res.json().catch(() => [])
  return Array.isArray(rows) && Array.isArray(rows[0]?.vehicles) ? rows[0].vehicles : []
}

export async function seedVehicle(page: Page, creds: SupaCreds, campaignId: string, vehicleId: string): Promise<{ ok: boolean; detail: string }> {
  const r = await rpcCall(page, 'update_vehicle_in_campaign', {
    p_campaign_id: campaignId, p_vehicle_id: vehicleId, p_new_vehicle: testVehicle(vehicleId),
  }, creds)
  return { ok: r.ok, detail: `${r.status} ${r.body}`.slice(0, 300) }
}

export async function restoreVehicles(page: Page, creds: SupaCreds, campaignId: string, vehicles: unknown[]): Promise<boolean> {
  const res = await page.request.patch(`${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}`, {
    headers: await authHeaders(creds, { 'Content-Type': 'application/json' }),
    data: { vehicles },
  })
  return res.ok()
}
