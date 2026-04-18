-- ============================================================
-- Setting Seed Tables — DB-backed seed data for campaign creation
-- Replaces the TypeScript seed files as the authoritative source.
-- Thrivers can "Sync to Seed" from a live campaign to update these.
-- Run in Supabase SQL Editor. Idempotent.
-- ============================================================

-- ── NPCs ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.setting_seed_npcs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting text NOT NULL,
  name text NOT NULL,
  reason integer NOT NULL DEFAULT 0,
  acumen integer NOT NULL DEFAULT 0,
  physicality integer NOT NULL DEFAULT 0,
  influence integer NOT NULL DEFAULT 0,
  dexterity integer NOT NULL DEFAULT 0,
  wp_max integer NOT NULL DEFAULT 10,
  rp_max integer NOT NULL DEFAULT 6,
  skills jsonb NOT NULL DEFAULT '{"entries":[]}'::jsonb,
  equipment jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  motivation text,
  portrait_url text,
  pin_title text,
  npc_type text,
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE (setting, name)
);

-- ── Pins ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.setting_seed_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting text NOT NULL,
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  notes text,
  category text DEFAULT 'location',
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE (setting, name)
);

-- ── Scenes ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.setting_seed_scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting text NOT NULL,
  name text NOT NULL,
  grid_cols integer NOT NULL DEFAULT 20,
  grid_rows integer NOT NULL DEFAULT 15,
  notes text,
  UNIQUE (setting, name)
);

-- ── Handouts ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.setting_seed_handouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting text NOT NULL,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  UNIQUE (setting, title)
);

-- ── RLS: anyone reads, thrivers write ───────────────────────
ALTER TABLE public.setting_seed_npcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setting_seed_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setting_seed_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setting_seed_handouts ENABLE ROW LEVEL SECURITY;

-- Read policies (anyone)
DROP POLICY IF EXISTS "Anyone reads seed npcs" ON setting_seed_npcs;
CREATE POLICY "Anyone reads seed npcs" ON setting_seed_npcs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Anyone reads seed pins" ON setting_seed_pins;
CREATE POLICY "Anyone reads seed pins" ON setting_seed_pins FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Anyone reads seed scenes" ON setting_seed_scenes;
CREATE POLICY "Anyone reads seed scenes" ON setting_seed_scenes FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Anyone reads seed handouts" ON setting_seed_handouts;
CREATE POLICY "Anyone reads seed handouts" ON setting_seed_handouts FOR SELECT TO anon, authenticated USING (true);

-- Write policies (thrivers only — checked by role in profiles)
DROP POLICY IF EXISTS "Thrivers write seed npcs" ON setting_seed_npcs;
CREATE POLICY "Thrivers write seed npcs" ON setting_seed_npcs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'thriver'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'thriver'));

DROP POLICY IF EXISTS "Thrivers write seed pins" ON setting_seed_pins;
CREATE POLICY "Thrivers write seed pins" ON setting_seed_pins FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'thriver'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'thriver'));

DROP POLICY IF EXISTS "Thrivers write seed scenes" ON setting_seed_scenes;
CREATE POLICY "Thrivers write seed scenes" ON setting_seed_scenes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'thriver'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'thriver'));

DROP POLICY IF EXISTS "Thrivers write seed handouts" ON setting_seed_handouts;
CREATE POLICY "Thrivers write seed handouts" ON setting_seed_handouts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'thriver'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'thriver'));
