-- Drop existing update/delete policies on calendar_events
DROP POLICY IF EXISTS "Admins and creators can update events" ON public.calendar_events;
DROP POLICY IF EXISTS "Admins and creators can delete events" ON public.calendar_events;
DROP POLICY IF EXISTS "Creators or admins can update events" ON public.calendar_events;
DROP POLICY IF EXISTS "Creators or admins can delete events" ON public.calendar_events;
DROP POLICY IF EXISTS "Update events" ON public.calendar_events;
DROP POLICY IF EXISTS "Delete events" ON public.calendar_events;

-- Only the creator can update their own events
CREATE POLICY "Only creator can update events"
ON public.calendar_events
FOR UPDATE
TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

-- Only the creator can delete their own events
CREATE POLICY "Only creator can delete events"
ON public.calendar_events
FOR DELETE
TO authenticated
USING (auth.uid() = created_by);