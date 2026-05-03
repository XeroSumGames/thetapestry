// GM Kit export — bundles a campaign's content into a downloadable zip.
//
// Output structure:
//   gm-kit-<slug>-<date>.zip
//   ├── manifest.json                 — campaign meta
//   ├── pins.json                     — campaign_pins rows
//   ├── npcs.json                     — campaign_npcs rows
//   ├── scenes.json                   — tactical_scenes rows
//   ├── tokens.json                   — scene_tokens grouped by scene_id
//   ├── handouts.json                 — campaign_notes rows (with attachment metadata)
//   └── images/                       — actual image files referenced above
//       ├── scene-bg-<sceneId>.<ext>
//       ├── npc-<npcId>.<ext>
//       ├── token-<tokenId>.<ext>
//       └── note-<noteId>-<i>.<ext>
//
// Image URLs in the JSON are rewritten to relative paths under images/ so a
// downstream consumer can read the kit offline.
//
// JSZip is loaded via dynamic import inside exportGmKit (~50KB) — it's only
// needed when the GM clicks Export, so skip pulling it into any bundle that
// merely touches this module.
import type { SupabaseClient } from '@supabase/supabase-js'

interface ExportResult {
  ok: boolean
  filename?: string
  error?: string
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'campaign'
}

function extFromUrl(url: string, fallback = 'jpg'): string {
  try {
    const u = new URL(url)
    const m = u.pathname.match(/\.([a-zA-Z0-9]{1,5})$/)
    return m ? m[1].toLowerCase() : fallback
  } catch { return fallback }
}

async function fetchAsBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.blob()
  } catch { return null }
}

export async function exportGmKit(supabase: SupabaseClient, campaignId: string): Promise<ExportResult> {
  // Wave 1 — campaign + every directly-filterable table in parallel.
  const [
    { data: campaign, error: campErr },
    { data: pins },
    { data: npcs },
    { data: scenes },
    { data: notes },
  ] = await Promise.all([
    supabase.from('campaigns').select('*').eq('id', campaignId).single(),
    supabase.from('campaign_pins').select('*').eq('campaign_id', campaignId).order('sort_order', { ascending: true, nullsFirst: false }),
    supabase.from('campaign_npcs').select('*').eq('campaign_id', campaignId).order('sort_order', { ascending: true, nullsFirst: false }),
    supabase.from('tactical_scenes').select('*').eq('campaign_id', campaignId),
    supabase.from('campaign_notes').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: true }),
  ])
  if (campErr || !campaign) return { ok: false, error: campErr?.message ?? 'Campaign not found' }

  // Wave 2 — scene_tokens scoped to THIS campaign's scenes only.
  // Pre-fix this lived in Wave 1 as an UNFILTERED `select('*')`, so every
  // GM Kit export streamed every other campaign's tokens across the wire
  // and relied on RLS as the only real defense. Now we hold the filter
  // server-side via .in('scene_id', sceneIds).
  const sceneIds = (scenes ?? []).map((s: any) => s.id)
  const { data: scopedTokensData } = sceneIds.length > 0
    ? await supabase.from('scene_tokens').select('*').in('scene_id', sceneIds)
    : { data: [] as any[] }
  const scopedTokens = (scopedTokensData ?? []) as any[]

  // Lazy-load JSZip — top-level import previously pulled ~50KB into any
  // client bundle that imported this module even when nobody clicked
  // Export. Dynamic import keeps that cost gated to actual exports.
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const images = zip.folder('images')!
  // Collect rewrites: original URL -> relative path inside zip
  const urlMap: Record<string, string> = {}

  async function pullImage(url: string | null | undefined, name: string): Promise<string | null> {
    if (!url) return null
    if (urlMap[url]) return urlMap[url] // de-dupe — same portrait used twice = one file
    const blob = await fetchAsBlob(url)
    if (!blob) return null
    const ext = extFromUrl(url, blob.type.split('/')[1] || 'jpg')
    const filename = `${name}.${ext}`
    images.file(filename, blob)
    const rel = `images/${filename}`
    urlMap[url] = rel
    return rel
  }

  // Scene backgrounds.
  const scenesOut = await Promise.all((scenes ?? []).map(async (s: any) => {
    const local = await pullImage(s.background_url, `scene-bg-${s.id}`)
    return { ...s, background_url_local: local, background_url: s.background_url }
  }))

  // NPC portraits.
  const npcsOut = await Promise.all((npcs ?? []).map(async (n: any) => {
    const local = await pullImage(n.portrait_url, `npc-${n.id}`)
    return { ...n, portrait_url_local: local, portrait_url: n.portrait_url }
  }))

  // Token portraits (object/character placeholders).
  const tokensOut = await Promise.all(scopedTokens.map(async (t: any) => {
    const local = await pullImage(t.portrait_url, `token-${t.id}`)
    return { ...t, portrait_url_local: local, portrait_url: t.portrait_url }
  }))

  // Note attachments (images + files).
  const notesOut = await Promise.all((notes ?? []).map(async (n: any) => {
    const atts = Array.isArray(n.attachments) ? n.attachments : []
    const newAtts = await Promise.all(atts.map(async (a: any, i: number) => {
      const local = await pullImage(a.url, `note-${n.id}-${i}`)
      return { ...a, url_local: local }
    }))
    return { ...n, attachments: newAtts }
  }))

  // Group tokens by scene for downstream import ergonomics.
  const tokensByScene: Record<string, any[]> = {}
  for (const t of tokensOut) {
    ;(tokensByScene[t.scene_id] ??= []).push(t)
  }

  zip.file('manifest.json', JSON.stringify({
    schema_version: 1,
    exported_at: new Date().toISOString(),
    campaign: {
      name: campaign.name,
      description: campaign.description,
      setting: campaign.setting,
      map_style: campaign.map_style,
      map_center_lat: campaign.map_center_lat,
      map_center_lng: campaign.map_center_lng,
    },
    counts: {
      pins: pins?.length ?? 0,
      npcs: npcs?.length ?? 0,
      scenes: scenes?.length ?? 0,
      tokens: scopedTokens.length,
      notes: notes?.length ?? 0,
      images: Object.keys(urlMap).length,
    },
  }, null, 2))
  zip.file('pins.json', JSON.stringify(pins ?? [], null, 2))
  zip.file('npcs.json', JSON.stringify(npcsOut, null, 2))
  zip.file('scenes.json', JSON.stringify(scenesOut, null, 2))
  zip.file('tokens.json', JSON.stringify(tokensByScene, null, 2))
  zip.file('handouts.json', JSON.stringify(notesOut, null, 2))

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  const dateStr = new Date().toISOString().slice(0, 10)
  const filename = `gm-kit-${slugify(campaign.name)}-${dateStr}.zip`

  // Trigger browser download.
  const a = document.createElement('a')
  const objectUrl = URL.createObjectURL(blob)
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)

  return { ok: true, filename }
}
