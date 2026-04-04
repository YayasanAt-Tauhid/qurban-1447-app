
-- Allow anon SELECT on shohibul_qurban for akad page
CREATE POLICY "Anon can view shohibul by id"
ON public.shohibul_qurban
FOR SELECT
TO anon
USING (true);

-- Allow anon UPDATE on shohibul_qurban for akad approval
CREATE POLICY "Anon can update akad fields"
ON public.shohibul_qurban
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Allow anon SELECT on hewan_qurban for akad page
CREATE POLICY "Anon can view hewan"
ON public.hewan_qurban
FOR SELECT
TO anon
USING (true);

-- Allow anon SELECT on request_bagian for akad page
CREATE POLICY "Anon can view request_bagian"
ON public.request_bagian
FOR SELECT
TO anon
USING (true);

-- Catatan lapangan table for distribution day
CREATE TABLE public.catatan_lapangan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hewan_id uuid REFERENCES public.hewan_qurban(id) ON DELETE CASCADE,
  catatan text NOT NULL,
  waktu timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.catatan_lapangan ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view catatan"
ON public.catatan_lapangan FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert catatan"
ON public.catatan_lapangan FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can delete catatan"
ON public.catatan_lapangan FOR DELETE TO authenticated USING (is_admin(auth.uid()));
