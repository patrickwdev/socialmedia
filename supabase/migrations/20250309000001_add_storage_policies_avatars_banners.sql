-- Storage RLS policies for avatars and banners buckets.
-- Run this in Supabase SQL Editor after 20250309000000 (buckets).
-- Safe to re-run: drops existing policies first.
-- Includes SELECT so public image URLs work; INSERT/UPDATE/DELETE for uploads.

-- Avatars – SELECT (public read so image URLs work)
DROP POLICY IF EXISTS "Avatar public read" ON storage.objects;
CREATE POLICY "Avatar public read"
ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');

-- Avatars – INSERT
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Avatar upload anon" ON storage.objects;
CREATE POLICY "Avatar upload anon"
ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Avatar update anon" ON storage.objects;
CREATE POLICY "Avatar update anon"
ON storage.objects FOR UPDATE TO anon USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Avatar delete anon" ON storage.objects;
CREATE POLICY "Avatar delete anon"
ON storage.objects FOR DELETE TO anon USING (bucket_id = 'avatars');

-- Banners – SELECT (public read)
DROP POLICY IF EXISTS "Banner public read" ON storage.objects;
CREATE POLICY "Banner public read"
ON storage.objects FOR SELECT TO public USING (bucket_id = 'banners');

-- Banners – INSERT
DROP POLICY IF EXISTS "Users can upload own banner" ON storage.objects;
CREATE POLICY "Users can upload own banner"
ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'banners');

DROP POLICY IF EXISTS "Banner upload anon" ON storage.objects;
CREATE POLICY "Banner upload anon"
ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'banners');

DROP POLICY IF EXISTS "Users can update own banner" ON storage.objects;
CREATE POLICY "Users can update own banner"
ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'banners');

DROP POLICY IF EXISTS "Banner update anon" ON storage.objects;
CREATE POLICY "Banner update anon"
ON storage.objects FOR UPDATE TO anon USING (bucket_id = 'banners');

DROP POLICY IF EXISTS "Users can delete own banner" ON storage.objects;
CREATE POLICY "Users can delete own banner"
ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'banners');

DROP POLICY IF EXISTS "Banner delete anon" ON storage.objects;
CREATE POLICY "Banner delete anon"
ON storage.objects FOR DELETE TO anon USING (bucket_id = 'banners');
