import { supabase } from '@/integrations/supabase/client';

export type CalendarCategory = 'meeting' | 'task' | 'training' | 'reminder' | 'other';
export type CalendarRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';
export type CalendarParticipantStatus = 'pending' | 'confirmed' | 'declined';

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  link: string | null;
  category: CalendarCategory;
  color: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  recurrence: CalendarRecurrence;
  recurrence_until: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CalendarParticipant {
  id: string;
  event_id: string;
  user_id: string;
  status: CalendarParticipantStatus;
  created_at: string;
}

export interface CalendarReminder {
  id: string;
  event_id: string;
  minutes_before: number;
  notified_at: string | null;
}

export interface CalendarEventWithDetails extends CalendarEvent {
  participants: (CalendarParticipant & { full_name?: string | null })[];
  reminders: CalendarReminder[];
}

export const CATEGORY_LABELS: Record<CalendarCategory, string> = {
  meeting: 'Reunião',
  task: 'Tarefa',
  training: 'Treinamento',
  reminder: 'Lembrete',
  other: 'Outro',
};

export const CATEGORY_COLORS: Record<CalendarCategory, string> = {
  meeting: '#3b82f6',
  task: '#10b981',
  training: '#a855f7',
  reminder: '#f59e0b',
  other: '#64748b',
};

export interface CreateEventInput {
  title: string;
  description?: string;
  location?: string;
  link?: string;
  category: CalendarCategory;
  color: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  recurrence: CalendarRecurrence;
  recurrence_until?: string | null;
  participant_ids: string[];
  reminder_minutes: number[];
}

export const calendarService = {
  async listEvents(rangeStart?: Date, rangeEnd?: Date): Promise<CalendarEventWithDetails[]> {
    let query = supabase
      .from('calendar_events')
      .select(`
        *,
        participants:calendar_event_participants(*),
        reminders:calendar_event_reminders(*)
      `)
      .order('starts_at', { ascending: true });

    if (rangeStart) query = query.gte('ends_at', rangeStart.toISOString());
    if (rangeEnd) query = query.lte('starts_at', rangeEnd.toISOString());

    const { data, error } = await query;
    if (error) throw error;

    const events = (data || []) as any[];
    // Enrich participants with names
    const allUserIds = Array.from(
      new Set(events.flatMap((e) => (e.participants || []).map((p: any) => p.user_id)))
    );

    let names: Record<string, string> = {};
    if (allUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', allUserIds);
      names = (profiles || []).reduce((acc, p: any) => {
        acc[p.user_id] = p.full_name || '';
        return acc;
      }, {} as Record<string, string>);
    }

    return events.map((e) => ({
      ...e,
      participants: (e.participants || []).map((p: any) => ({
        ...p,
        full_name: names[p.user_id] || 'Usuário',
      })),
      reminders: e.reminders || [],
    }));
  },

  async createEvent(input: CreateEventInput): Promise<string> {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) throw new Error('Não autenticado');

    const { data: event, error } = await supabase
      .from('calendar_events')
      .insert({
        title: input.title,
        description: input.description || null,
        location: input.location || null,
        link: input.link || null,
        category: input.category,
        color: input.color,
        starts_at: input.starts_at,
        ends_at: input.ends_at,
        all_day: input.all_day,
        recurrence: input.recurrence,
        recurrence_until: input.recurrence_until || null,
        created_by: userId,
      })
      .select('id')
      .single();

    if (error) throw error;
    const eventId = event.id;

    if (input.participant_ids.length > 0) {
      const rows = input.participant_ids.map((uid) => ({
        event_id: eventId,
        user_id: uid,
        status: uid === userId ? 'confirmed' : 'pending',
      }));
      const { error: pErr } = await supabase.from('calendar_event_participants').insert(rows as any);
      if (pErr) throw pErr;
    }

    if (input.reminder_minutes.length > 0) {
      const rows = input.reminder_minutes.map((m) => ({
        event_id: eventId,
        minutes_before: m,
      }));
      const { error: rErr } = await supabase.from('calendar_event_reminders').insert(rows);
      if (rErr) throw rErr;
    }

    return eventId;
  },

  async updateEvent(id: string, input: CreateEventInput): Promise<void> {
    const { error } = await supabase
      .from('calendar_events')
      .update({
        title: input.title,
        description: input.description || null,
        location: input.location || null,
        link: input.link || null,
        category: input.category,
        color: input.color,
        starts_at: input.starts_at,
        ends_at: input.ends_at,
        all_day: input.all_day,
        recurrence: input.recurrence,
        recurrence_until: input.recurrence_until || null,
      })
      .eq('id', id);
    if (error) throw error;

    // Replace participants
    await supabase.from('calendar_event_participants').delete().eq('event_id', id);
    if (input.participant_ids.length > 0) {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      const rows = input.participant_ids.map((uid) => ({
        event_id: id,
        user_id: uid,
        status: uid === userId ? 'confirmed' : 'pending',
      }));
      await supabase.from('calendar_event_participants').insert(rows as any);
    }

    // Replace reminders
    await supabase.from('calendar_event_reminders').delete().eq('event_id', id);
    if (input.reminder_minutes.length > 0) {
      const rows = input.reminder_minutes.map((m) => ({ event_id: id, minutes_before: m }));
      await supabase.from('calendar_event_reminders').insert(rows);
    }
  },

  async deleteEvent(id: string): Promise<void> {
    const { error } = await supabase.from('calendar_events').delete().eq('id', id);
    if (error) throw error;
  },

  async setParticipantStatus(eventId: string, status: CalendarParticipantStatus): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) throw new Error('Não autenticado');
    const { error } = await supabase
      .from('calendar_event_participants')
      .update({ status })
      .eq('event_id', eventId)
      .eq('user_id', userId);
    if (error) throw error;
  },

  async listAdminUsers(): Promise<{ user_id: string; full_name: string }[]> {
    const { data: roles } = await supabase.from('user_roles').select('user_id');
    const ids = Array.from(new Set((roles || []).map((r: any) => r.user_id)));
    if (ids.length === 0) return [];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', ids)
      .order('full_name');
    return (profiles || []) as any;
  },
};
