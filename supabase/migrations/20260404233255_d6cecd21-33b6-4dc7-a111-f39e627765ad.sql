
-- Fix security definer views by recreating as security invoker
DROP VIEW IF EXISTS public.distribusi_bagian;
CREATE VIEW public.distribusi_bagian WITH (security_invoker = true) AS
SELECT
  rb.hewan_id,
  rb.bagian,
  COUNT(rb.id) AS jumlah_request,
  ARRAY_AGG(sq.nama) AS list_nama_shohibul,
  CASE
    WHEN COUNT(rb.id) = 0 THEN 'ke_mustahiq'
    ELSE 'ke_shohibul'
  END AS status
FROM public.request_bagian rb
JOIN public.shohibul_qurban sq ON sq.id = rb.shohibul_qurban_id
GROUP BY rb.hewan_id, rb.bagian;

DROP VIEW IF EXISTS public.hewan_dengan_kuota;
CREATE VIEW public.hewan_dengan_kuota WITH (security_invoker = true) AS
SELECT
  h.*,
  h.kuota - COALESCE(cnt.total, 0) AS sisa_kuota
FROM public.hewan_qurban h
LEFT JOIN (
  SELECT hewan_id, COUNT(*) AS total
  FROM public.shohibul_qurban
  GROUP BY hewan_id
) cnt ON cnt.hewan_id = h.id;

-- Fix overly permissive request_bagian policies
DROP POLICY IF EXISTS "Authenticated can insert request_bagian" ON public.request_bagian;
DROP POLICY IF EXISTS "Authenticated can update request_bagian" ON public.request_bagian;
DROP POLICY IF EXISTS "Authenticated can delete request_bagian" ON public.request_bagian;

CREATE POLICY "Admins can insert request_bagian" ON public.request_bagian
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update request_bagian" ON public.request_bagian
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete request_bagian" ON public.request_bagian
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
