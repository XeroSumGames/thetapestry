-- Add is_private flag to portrait_bank.
-- Allows players/GMs to keep a portrait out of the shared library.
-- DEFAULT false = all existing rows stay public; nothing breaks.
ALTER TABLE portrait_bank
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;
