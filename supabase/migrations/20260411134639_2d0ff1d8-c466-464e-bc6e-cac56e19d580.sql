
-- Conversations table
CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text,
  type text NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Conversation members
CREATE TABLE public.conversation_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

-- Chat messages
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user is member of conversation
CREATE OR REPLACE FUNCTION public.is_conversation_member(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE user_id = _user_id AND conversation_id = _conversation_id
  )
$$;

-- RLS: conversations
CREATE POLICY "Members can view their conversations"
ON public.conversations FOR SELECT
TO authenticated
USING (is_conversation_member(auth.uid(), id));

CREATE POLICY "Any admin user can create conversations"
ON public.conversations FOR INSERT
TO authenticated
WITH CHECK (has_any_admin_role(auth.uid()) AND auth.uid() = created_by);

CREATE POLICY "Creator can update conversation"
ON public.conversations FOR UPDATE
TO authenticated
USING (auth.uid() = created_by);

-- RLS: conversation_members
CREATE POLICY "Members can view members of their conversations"
ON public.conversation_members FOR SELECT
TO authenticated
USING (is_conversation_member(auth.uid(), conversation_id));

CREATE POLICY "Admin users can add members"
ON public.conversation_members FOR INSERT
TO authenticated
WITH CHECK (has_any_admin_role(auth.uid()));

CREATE POLICY "Users can remove themselves"
ON public.conversation_members FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- RLS: chat_messages
CREATE POLICY "Members can view messages"
ON public.chat_messages FOR SELECT
TO authenticated
USING (is_conversation_member(auth.uid(), conversation_id));

CREATE POLICY "Members can send messages"
ON public.chat_messages FOR INSERT
TO authenticated
WITH CHECK (is_conversation_member(auth.uid(), conversation_id) AND auth.uid() = sender_id);

-- Indexes
CREATE INDEX idx_chat_messages_conversation ON public.chat_messages(conversation_id, created_at DESC);
CREATE INDEX idx_conversation_members_user ON public.conversation_members(user_id);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Trigger for updated_at on conversations
CREATE TRIGGER update_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
