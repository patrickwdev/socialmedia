-- Storage buckets + RLS policies for profile avatars and banners.
-- Used by signup and edit profile flows.

-- Create public buckets for profile avatars and banners.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true),
       ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;

-- Avatars: allow authenticated users to manage only their own folder: avatars/{user_id}/...
CREATE POLICY "Users can upload own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Banners: allow authenticated users to manage only their own folder: banners/{user_id}/...
CREATE POLICY "Users can upload own banner"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'banners'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own banner"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'banners'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own banner"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'banners'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

