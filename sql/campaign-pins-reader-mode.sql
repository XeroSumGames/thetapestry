-- Add reader_mode to campaign_pins so a pin can declare itself as a
-- multi-page reader surface (comic book, magazine, photo album).
-- The /reader-popout route opens these in a page-flip UI that pulls
-- pages from the pin's existing pin-attachments storage path.
--
-- Values today: 'comic' (only one defined). Add more in the future
-- without touching this migration — text column with no CHECK so
-- adoption is forward-compatible.
--
-- Idempotent. Safe to re-run.

ALTER TABLE public.campaign_pins
  ADD COLUMN IF NOT EXISTS reader_mode text;

COMMENT ON COLUMN public.campaign_pins.reader_mode IS
  'When set, the pin opens a reader popout instead of acting as a normal location pin. Current values: ''comic''. Pages = the pin''s sorted image attachments.';
