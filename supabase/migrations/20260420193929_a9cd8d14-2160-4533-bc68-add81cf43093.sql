-- Enum para categoria
CREATE TYPE public.calendar_event_category AS ENUM ('meeting', 'task', 'training', 'reminder', 'other');
CREATE TYPE public.calendar_recurrence AS ENUM ('none', 'daily', 'weekly', 'monthly');
CREATE TYPE public.calendar_participant_status AS ENUM ('pending', 'confirmed', 'declined');

-- Tabela principal de eventos
CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  link TEXT,
  category public.calendar_event_category NOT NULL DEFAULT 'meeting',
  color TEXT NOT NULL DEFAULT '#3b82f6',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT false,
  recurrence public.calendar_recurrence NOT NULL DEFAULT 'none',
  recurrence_until TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_calendar_events_starts_at ON public.calendar_events(starts_at);
CREATE INDEX idx_calendar_events_created_by ON public.calendar_events(created_by);

-- Participantes
CREATE TABLE public.calendar_event_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status public.calendar_participant_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX idx_calendar_participants_user ON public.calendar_event_participants(user_id);
CREATE INDEX idx_calendar_participants_event ON public.calendar_event_participants(event_id);

-- Lembretes
CREATE TABLE public.calendar_event_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  minutes_before INTEGER NOT NULL DEFAULT 15,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_calendar_reminders_event ON public.calendar_event_reminders(event_id);

-- Trigger updated_at
CREATE TRIGGER update_calendar_events_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_event_reminders ENABLE ROW LEVEL SECURITY;

-- Helper: usuário é participante do evento
CREATE OR REPLACE FUNCTION public.is_event_participant(_user_id uuid, _event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.calendar_event_participants
    WHERE user_id = _user_id AND event_id = _event_id
  )
$$;

-- ===== POLÍTICAS calendar_events =====
-- Admin/Gerente gerenciam tudo
CREATE POLICY "Admin/Manager manage all events"
ON public.calendar_events FOR ALL TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

-- Qualquer usuário admin pode criar
CREATE POLICY "Admin users can create events"
ON public.calendar_events FOR INSERT TO authenticated
WITH CHECK (has_any_admin_role(auth.uid()) AND auth.uid() = created_by);

-- Ver: criador, participante ou admin
CREATE POLICY "Users view own or participating events"
ON public.calendar_events FOR SELECT TO authenticated
USING (
  has_any_admin_role(auth.uid()) AND (
    auth.uid() = created_by
    OR is_event_participant(auth.uid(), id)
    OR is_admin_or_manager(auth.uid())
  )
);

-- Criador pode editar
CREATE POLICY "Creator can update own events"
ON public.calendar_events FOR UPDATE TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

-- Criador pode deletar
CREATE POLICY "Creator can delete own events"
ON public.calendar_events FOR DELETE TO authenticated
USING (auth.uid() = created_by);

-- ===== POLÍTICAS calendar_event_participants =====
CREATE POLICY "Admin/Manager manage all participants"
ON public.calendar_event_participants FOR ALL TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

-- Ver participantes de eventos visíveis
CREATE POLICY "Users view participants of their events"
ON public.calendar_event_participants FOR SELECT TO authenticated
USING (
  has_any_admin_role(auth.uid()) AND (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.calendar_events e WHERE e.id = event_id AND e.created_by = auth.uid())
    OR is_admin_or_manager(auth.uid())
  )
);

-- Criador adiciona participantes
CREATE POLICY "Event creator adds participants"
ON public.calendar_event_participants FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.calendar_events e WHERE e.id = event_id AND e.created_by = auth.uid())
  OR is_admin_or_manager(auth.uid())
);

-- Participante pode atualizar próprio status; criador pode alterar qualquer
CREATE POLICY "Update participation status"
ON public.calendar_event_participants FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.calendar_events e WHERE e.id = event_id AND e.created_by = auth.uid())
  OR is_admin_or_manager(auth.uid())
)
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.calendar_events e WHERE e.id = event_id AND e.created_by = auth.uid())
  OR is_admin_or_manager(auth.uid())
);

-- Criador remove participantes; participante pode remover-se
CREATE POLICY "Delete participants"
ON public.calendar_event_participants FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.calendar_events e WHERE e.id = event_id AND e.created_by = auth.uid())
  OR is_admin_or_manager(auth.uid())
);

-- ===== POLÍTICAS calendar_event_reminders =====
CREATE POLICY "Admin/Manager manage all reminders"
ON public.calendar_event_reminders FOR ALL TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "View reminders of accessible events"
ON public.calendar_event_reminders FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.calendar_events e
    WHERE e.id = event_id AND (
      e.created_by = auth.uid()
      OR is_event_participant(auth.uid(), e.id)
      OR is_admin_or_manager(auth.uid())
    )
  )
);

CREATE POLICY "Creator manages reminders insert"
ON public.calendar_event_reminders FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.calendar_events e WHERE e.id = event_id AND e.created_by = auth.uid())
  OR is_admin_or_manager(auth.uid())
);

CREATE POLICY "Creator manages reminders update"
ON public.calendar_event_reminders FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.calendar_events e WHERE e.id = event_id AND e.created_by = auth.uid())
  OR is_admin_or_manager(auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.calendar_events e WHERE e.id = event_id AND e.created_by = auth.uid())
  OR is_admin_or_manager(auth.uid())
);

CREATE POLICY "Creator manages reminders delete"
ON public.calendar_event_reminders FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.calendar_events e WHERE e.id = event_id AND e.created_by = auth.uid())
  OR is_admin_or_manager(auth.uid())
);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_event_participants;