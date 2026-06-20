-- Restrict Realtime channel subscriptions to admin users to prevent PII leakage
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin only realtime select" ON realtime.messages;
CREATE POLICY "admin only realtime select"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.has_any_admin_role(auth.uid()));