-- ============================================================
-- District Zero Seed SQL
-- Run this entire block in Supabase SQL Editor
-- REPLACE '5806fd27-fcac-4163-b8a8-61476150962c' with your actual user ID (uuid)
-- ============================================================

-- ── 1. Create campaign_npcs table ────────────────────────────

CREATE TABLE campaign_npcs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  campaign_pin_id uuid REFERENCES campaign_pins(id) ON DELETE SET NULL,
  name text NOT NULL,
  rapid_range text,
  wp integer,
  rp integer,
  dmm integer,
  dmr integer,
  init integer,
  per integer,
  enc integer,
  pt integer,
  skills jsonb DEFAULT '[]',
  equipment jsonb DEFAULT '[]',
  role text,
  description text,
  how_to_meet text,
  motivation text,
  revealed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE campaign_npcs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Campaign members can read campaign npcs"
  ON campaign_npcs FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM campaign_members cm
            WHERE cm.campaign_id = campaign_npcs.campaign_id AND cm.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM campaigns c
               WHERE c.id = campaign_npcs.campaign_id AND c.gm_user_id = auth.uid())
  );

CREATE POLICY "GM can manage campaign npcs"
  ON campaign_npcs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM campaigns c
                 WHERE c.id = campaign_npcs.campaign_id AND c.gm_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM campaigns c
                      WHERE c.id = campaign_npcs.campaign_id AND c.gm_user_id = auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE campaign_npcs;


-- ── 2. Seed District Zero pins into world map ────────────────

INSERT INTO map_pins (user_id, lat, lng, title, notes, pin_type, status, category) VALUES
-- Gates
('5806fd27-fcac-4163-b8a8-61476150962c', 36.0526, -95.7978, 'West Gate', 'Primary entrance for non-residents. Guards search all visitors. Non-residents enter here only. West Broadway & S Elm Place.', 'gm', 'approved', 'military'),
('5806fd27-fcac-4163-b8a8-61476150962c', 36.0580, -95.7902, 'North Gate', 'Northern entrance/exit. W Kenosha St & N Main St. Residents can use freely within curfew rules.', 'gm', 'approved', 'military'),
('5806fd27-fcac-4163-b8a8-61476150962c', 36.0452, -95.7902, 'South Gate', 'Southern entrance/exit. Houston St & S Main St. Near the Performing Arts Center.', 'gm', 'approved', 'military'),
('5806fd27-fcac-4163-b8a8-61476150962c', 36.0505, -95.7782, 'East Gate (Farm Gate)', 'Separates District Zero from District One (the Farm). E College St & County Line Rd. Always has at least two guards plus a watchtower sniper.', 'gm', 'approved', 'military'),
-- Watchtowers
('5806fd27-fcac-4163-b8a8-61476150962c', 36.0578, -95.7978, 'Watchtower — NW Corner', 'Corner watchtower. Battery-powered radio, siren, and powerful flashlight. Constant comms with City Hall shift leader.', 'gm', 'approved', 'military'),
('5806fd27-fcac-4163-b8a8-61476150962c', 36.0578, -95.7828, 'Watchtower — NE Corner', 'Corner watchtower. Overlooks the Refinery approach. Battery-powered radio, siren, flashlight.', 'gm', 'approved', 'military'),
('5806fd27-fcac-4163-b8a8-61476150962c', 36.0452, -95.7978, 'Watchtower — SW Corner', 'Corner watchtower. Covers the rail line crossing. Battery-powered radio, siren, flashlight.', 'gm', 'approved', 'military'),
('5806fd27-fcac-4163-b8a8-61476150962c', 36.0452, -95.7828, 'Watchtower — SE Corner', 'Corner watchtower. Battery-powered radio, siren, flashlight.', 'gm', 'approved', 'military'),
('5806fd27-fcac-4163-b8a8-61476150962c', 36.0580, -95.7895, 'Watchtower — North Gate', 'Covers the North Gate. Sharpshooter always on duty.', 'gm', 'approved', 'military'),
('5806fd27-fcac-4163-b8a8-61476150962c', 36.0528, -95.7978, 'Watchtower — West Gate', 'Covers the West Gate. Primary public-facing tower.', 'gm', 'approved', 'military'),
('5806fd27-fcac-4163-b8a8-61476150962c', 36.0452, -95.7896, 'Watchtower — South Gate', 'Covers the South Gate. Sharpshooter always on duty.', 'gm', 'approved', 'military'),
('5806fd27-fcac-4163-b8a8-61476150962c', 36.0507, -95.7800, 'Watchtower — East Gate', 'Covers the Farm gate. Extra vigilance due to distance from the Mile.', 'gm', 'approved', 'military'),
-- Named Locations
('5806fd27-fcac-4163-b8a8-61476150962c', 36.0510, -95.7900, '01 | City Hall', 'Center of all official business. Lincoln Sawyer and Mitch Kosinski both keep offices here. Deputies use this as their HQ. Secure holding area in the basement (capacity 12). Has served as a courthouse. S Main St near W Commercial St.', 'gm', 'approved', 'government'),
('5806fd27-fcac-4163-b8a8-61476150962c', 36.0555, -95.7904, '02 | Farmer''s Market', 'Overseen by Tom Orchard. Central meeting point for trade. Up to 30+ vendors on busy days. Deputies always visible. Currency: bullets and batteries. No tax but the district expects a cut. N Main St area.', 'gm', 'approved', 'business'),
('5806fd27-fcac-4163-b8a8-61476150962c', 36.0512, -95.7898, '03 | Main Street Tavern', 'Run by Jemimah Sawyer (Lincoln''s former daughter-in-law). Open noon until last call. Moonshine and grain alcohols. Cooked food available. Community social hub. S Main St.', 'gm', 'approved', 'business'),
('5806fd27-fcac-4163-b8a8-61476150962c', 36.0507, -95.7897, '04 | The Bike Shop', 'Run by Emma Hernandez. Primary transport repair for the Mile. Open to the public two days a week. Emma also scavenges for parts. S Main St near W Dallas St.', 'gm', 'approved', 'business'),
('5806fd27-fcac-4163-b8a8-61476150962c', 36.0520, -95.7838, '05 | The Clinic', 'Run by Morgan Lieu (vet tech — closest thing to a doctor the Mile has). Multiple exam rooms and beds. Heavy reliance on herbal remedies due to supply scarcity. N 5th St area, east side of the Mile.', 'gm', 'approved', 'medical'),
('5806fd27-fcac-4163-b8a8-61476150962c', 36.0513, -95.7901, '06 | The Vault', 'Converted bank. Central storage facility. Deputies'' armory inside. Wesley Spencer manages district supplies. Key-operated locks — no power to electronic systems. Deputies patrol start/end here. Near City Hall and the Tavern.', 'gm', 'approved', 'resource'),
('5806fd27-fcac-4163-b8a8-61476150962c', 36.0515, -95.7899, '07 | The Kitchen', 'Run by Nana Welch and her ''angels'' (volunteers). Converted restaurant kitchen. One meal per resident per day, served at sundown. Borders Centennial Park. S Main St.', 'gm', 'approved', 'community'),
('5806fd27-fcac-4163-b8a8-61476150962c', 36.0520, -95.7897, '08 | The College', 'Run by Carol Philips. Converted private facility for advanced education. Practical adult classes: gardening, farming, house repairs, bike maintenance. Coordinated with the School for children. S Main / Broadway area.', 'gm', 'approved', 'community'),
('5806fd27-fcac-4163-b8a8-61476150962c', 36.0527, -95.7938, '09 | The Workshop', 'Run by Nate Landry. Communal tools and equipment. Small generator powers the tools. Free for residents, fee for outsiders based on complexity. Nate is planning a bullet factory here. W Detroit St area.', 'gm', 'approved', 'business'),
('5806fd27-fcac-4163-b8a8-61476150962c', 36.0505, -95.7901, '10 | First Church of the District', 'Run by Father Donalds. Originally a parish — renamed to non-denominational ''First Church of the District'' to promote inclusion, which backfired and split the congregation. Sunday services. Community potlucks. S Main near E College St.', 'gm', 'approved', 'location'),
('5806fd27-fcac-4163-b8a8-61476150962c', 36.0535, -95.7905, '11 | Chamber of Commerce', 'Administrative hub. Wesley Spencer operates here. Monthly city council meetings (capacity 150). Tom Orchard has an office here too. N Main St area.', 'gm', 'approved', 'government'),
('5806fd27-fcac-4163-b8a8-61476150962c', 36.0530, -95.7908, '12 | The Rose Rooms', 'Converted apartment building, run by Marcy Cunningham. 55 furnished apartments, multiple beds each. Cost: 20 bullets or batteries/night. Heated rooms extra (5 bullets/person/night). Visitor permit required to reserve. Marcy lives onsite and accepts cigarettes (though Wesley disapproves). N Main area near W Elgin St.', 'gm', 'approved', 'residence'),
('5806fd27-fcac-4163-b8a8-61476150962c', 36.0558, -95.7910, '13 | Nate''s Auto Shop', 'Run by Johnson Walker. Converts vehicles to run on biofuel from the Refinery. Maintains patrol cars, motorbikes, trucks, and farm equipment. Vehicles stored behind the shop. Requires Wesley''s authorization to borrow a vehicle. N Main/Ash area.', 'gm', 'approved', 'business'),
('5806fd27-fcac-4163-b8a8-61476150962c', 36.0572, -95.7852, '14 | Church of Christ', 'Breakaway congregation led by lay preacher Milo Cantwell. Fire-and-brimstone sermons. Members refusing work rosters and isolating from the community — a growing concern for Lincoln and Mitch. Deputies instructed to watch this area closely. NE corner near N 4th St.', 'gm', 'approved', 'location'),
('5806fd27-fcac-4163-b8a8-61476150962c', 36.0575, -95.7832, '15 | The Refinery', 'Run by Gio Leone. Produces ethanol and methanol biofuel from organic matter. Powers vehicles, lamps, lights, and furnaces. Critical infrastructure. Highly volatile during operation — fire risk. Always has at least one deputy and watchtower 4 oversight. Far NE corner of the Mile.', 'gm', 'approved', 'resource'),
('5806fd27-fcac-4163-b8a8-61476150962c', 36.0462, -95.7830, '16 | The School (Broken Arrow Academy)', 'Run by Jeremy Barrow and volunteer educators. Roughly 60 school-age children. Math, geography, history, literature, and practical skills. Jeremy has gathered almost all library books into the school. SE corner of the Mile.', 'gm', 'approved', 'community'),
-- District One (The Farm)
('5806fd27-fcac-4163-b8a8-61476150962c', 36.0530, -95.7820, '17 | The Farm (District One)', 'District One. Nearly 350 acres of converted farmland east of the Mile. Managed by David Battersby. Chickens, cattle, crops. A planned hydroponics warehouse is in discussion. Primary food source for the Mile.', 'gm', 'approved', 'location'),
('5806fd27-fcac-4163-b8a8-61476150962c', 36.0462, -95.7800, '18 | David''s Farmhouse', 'David Battersby''s residence on the southeast corner of the Farm. He lives close to the land by choice.', 'gm', 'approved', 'residence'),
('5806fd27-fcac-4163-b8a8-61476150962c', 36.0500, -95.7840, '19 | The Greenhouse', 'Proposed hydroponics facility in a converted District One warehouse. David and Gio are planning this to grow fruit and vegetables in a controlled environment. Not yet operational.', 'gm', 'approved', 'resource');


-- ── 3. Fix existing campaigns with old setting key ───────────

UPDATE campaigns SET setting = 'district_zero' WHERE setting = 'district0';
