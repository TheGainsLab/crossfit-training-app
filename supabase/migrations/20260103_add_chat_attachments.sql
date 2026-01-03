-- Add attachments support to chat
-- Storage bucket for chat attachments + column for attachment metadata

-- Add attachments column to support_messages
ALTER TABLE public.support_messages
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT NULL;

-- Comment explaining the structure
COMMENT ON COLUMN support_messages.attachments IS 'Array of attachment objects: [{type: "image"|"video", url: string, thumbnail_url?: string, filename: string, size_bytes: number}]';

-- Create storage bucket for chat attachments (run this in Supabase dashboard or via CLI)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('chat-attachments', 'chat-attachments', false)
-- ON CONFLICT (id) DO NOTHING;

-- Note: Storage bucket policies need to be set up in Supabase dashboard:
-- 1. Allow authenticated users to upload to their own folder (user_id/*)
-- 2. Allow authenticated users to read files from conversations they're part of
-- 3. Allow admins to read/write all files
