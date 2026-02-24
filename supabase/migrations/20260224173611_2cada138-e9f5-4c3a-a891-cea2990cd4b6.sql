
-- Allow any authenticated user to create their own POS sessions
CREATE POLICY "Users can create their own sessions"
ON public.pos_sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own sessions (e.g., close session)
CREATE POLICY "Users can update their own sessions"
ON public.pos_sessions
FOR UPDATE
USING (auth.uid() = user_id);

-- Allow any authenticated user to create transactions in their sessions
CREATE POLICY "Users can create transactions in their sessions"
ON public.pos_transactions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM pos_sessions
    WHERE pos_sessions.id = pos_transactions.session_id
    AND pos_sessions.user_id = auth.uid()
  )
);
