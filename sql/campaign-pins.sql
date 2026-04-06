CREATE TABLE campaign_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  notes text,
  category text DEFAULT 'location',
  revealed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE campaign_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Campaign members can read campaign pins"
  ON campaign_pins FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM campaign_members cm WHERE cm.campaign_id = campaign_pins.campaign_id AND cm.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_pins.campaign_id AND c.gm_user_id = auth.uid())
  );

CREATE POLICY "GM can manage campaign pins"
  ON campaign_pins FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_pins.campaign_id AND c.gm_user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_pins.campaign_id AND c.gm_user_id = auth.uid())
  );

ALTER PUBLICATION supabase_realtime ADD TABLE campaign_pins;
