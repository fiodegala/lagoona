DROP POLICY IF EXISTS "Anyone authenticated can view manual videos" ON public.manual_videos;

CREATE POLICY "Staff can view active manual videos"
ON public.manual_videos
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (is_active = true AND public.has_any_admin_role(auth.uid()))
);