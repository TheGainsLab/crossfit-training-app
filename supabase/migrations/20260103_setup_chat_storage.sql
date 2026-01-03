-- Setup Storage Bucket and Policies for Chat Attachments
-- Run this in the Supabase SQL Editor

-- ============================================
-- 1. CREATE STORAGE BUCKET
-- ============================================

-- Create the chat-attachments bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  true,  -- Public bucket so URLs work without auth tokens
  52428800,  -- 50MB max file size
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================
-- 2. STORAGE POLICIES
-- ============================================

-- Drop existing policies if they exist (for clean re-runs)
DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can read attachments from their conversations" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for chat attachments" ON storage.objects;

-- Policy 1: Users can upload files to their own folder
-- Path format: {user_id}/{filename}
CREATE POLICY "Users can upload to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND (storage.foldername(name))[1] = (
    SELECT id::text FROM public.users
    WHERE auth_id = auth.uid()
  )
);

-- Policy 2: Users can update their own files
CREATE POLICY "Users can update own attachments"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND (storage.foldername(name))[1] = (
    SELECT id::text FROM public.users
    WHERE auth_id = auth.uid()
  )
);

-- Policy 3: Users can delete their own files
CREATE POLICY "Users can delete own attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND (storage.foldername(name))[1] = (
    SELECT id::text FROM public.users
    WHERE auth_id = auth.uid()
  )
);

-- Policy 4: Public read access for chat attachments
-- Since bucket is public, anyone with the URL can view
-- (This is simpler than checking conversation membership)
CREATE POLICY "Public read access for chat attachments"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'chat-attachments');

-- Policy 5: Admins can manage all attachments
CREATE POLICY "Admins can manage all attachments"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role IN ('admin', 'superadmin')
  )
)
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role IN ('admin', 'superadmin')
  )
);

-- ============================================
-- 3. VERIFICATION QUERIES (optional)
-- ============================================

-- Verify bucket was created
-- SELECT * FROM storage.buckets WHERE id = 'chat-attachments';

-- Verify policies were created
-- SELECT policyname, permissive, roles, cmd
-- FROM pg_policies
-- WHERE schemaname = 'storage' AND tablename = 'objects';
