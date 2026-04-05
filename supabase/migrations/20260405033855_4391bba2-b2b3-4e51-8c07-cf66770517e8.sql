DROP POLICY IF EXISTS "Admins can update mustahiq" ON public.mustahiq;

CREATE POLICY "Hanya admin kupon yang bisa update mustahiq"
ON public.mustahiq
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.panitia
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin_kupon')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.panitia
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin_kupon')
  )
);