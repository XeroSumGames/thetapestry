-- Add whisper support to chat_messages
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS is_whisper boolean NOT NULL DEFAULT false;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS recipient_user_id uuid;
