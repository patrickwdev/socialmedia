-- Public bucket for post images/videos (URLs stored in posts.content / posts.assets).
-- Paths: post_media/{user_id}/{filename}

INSERT INTO storage.buckets (id, name, public)
VALUES ('post_media', 'post_media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "post_media public read" ON storage.objects;
CREATE POLICY "post_media public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'post_media');

DROP POLICY IF EXISTS "Users can upload own post media" ON storage.objects;
CREATE POLICY "Users can upload own post media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'post_media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can update own post media" ON storage.objects;
CREATE POLICY "Users can update own post media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'post_media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can delete own post media" ON storage.objects;
CREATE POLICY "Users can delete own post media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'post_media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
