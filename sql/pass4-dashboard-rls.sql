-- Dashboard RLS: Thrivers can read visitor_logs
CREATE POLICY "Thrivers can read visitor logs"
  ON visitor_logs FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Thriver')
  );
