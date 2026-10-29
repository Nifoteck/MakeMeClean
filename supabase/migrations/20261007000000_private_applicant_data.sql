-- Restrict applicant records and identity documents to their owner and admins.
-- Apply this migration before deploying the private-document upload changes.

DROP POLICY IF EXISTS "Profiles readable by all authenticated" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  ]::text[]
WHERE id = 'applications';

DROP POLICY IF EXISTS "Anyone can upload applications" ON storage.objects;
DROP POLICY IF EXISTS "Public read applications" ON storage.objects;
DROP POLICY IF EXISTS "Applicants upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Applicants and admins read application documents" ON storage.objects;

CREATE POLICY "Applicants upload their own documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'applications'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Applicants and admins read application documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'applications'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin(auth.uid())
    )
  );
