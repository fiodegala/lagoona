import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Plus, MapPin, Link as LinkIcon, Users, Clock, CalendarDays } from 'lucide-react';
import { calendarService, type CalendarEventWithDetails, CATEGORY_LABELS } from '@/services/calendar';
import EventFormModal from '@/components/calendar/EventFormModal';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

type View = 'month' | 'week' | 'day' | 'list';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const startOfWeek = (d: Date) => { const x = startOfDay(d); x.setDate(x.getDate() - x.getDay()); return x; };
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

// Expand recurring events within a window
const expandEvents = (events: CalendarEventWithDetails[], rangeStart: Date, rangeEnd: Date): CalendarEventWithDetails[] => {
  const result: CalendarEventWithDetails[] = [];
  for (const ev of events) {
    if (ev.recurrence === 'none') {
      const s = new Date(ev.starts_at);
      const e = new Date(ev.ends_at);
      if (e >= rangeStart && s <= rangeEnd) result.push(ev);
      continue;
    }
    const origStart = new Date(ev.starts_at);
    const origEnd = new Date(ev.ends_at);
    const dur = origEnd.getTime() - origStart.getTime();
    const limit = ev.recurrence_until ? new Date(ev.recurrence_until) : addDays(rangeEnd, 1);
    let cur = new Date(origStart);
    let safety = 0;
    while (cur <= limit && cur <= rangeEnd && safety < 500) {
      const endCur = new Date(cur.getTime() + dur);
      if (endCur >= rangeStart) {
        result.push({ ...ev, starts_at: cur.toISOString(), ends_at: endCur.toISOString() });
      }
      if (ev.recurrence === 'daily') cur = addDays(cur, 1);
      else if (ev.recurrence === 'weekly') cur = addDays(cur, 7);
      else if (ev.recurrence === 'monthly') {
        cur = new Date(cur);
        cur.setMonth(cur.getMonth() + 1);
      } else break;
      safety++;
    }
  }
  return result.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
};

const CalendarPage = () => {
  const { user } = useAuth();
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState(new Date());
  const [events, setEvents] = useState<CalendarEventWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventWithDetails | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>();

  const range = useMemo(() => {
    if (view === 'month') {
      const start = startOfWeek(startOfMonth(cursor));
      const end = addDays(start, 41);
      return { start, end };
    }
    if (view === 'week') {
      const start = startOfWeek(cursor);
      return { start, end: addDays(start, 6) };
    }
    if (view === 'day') {
      const start = startOfDay(cursor);
      return { start, end: addDays(start, 1) };
    }
    return { start: startOfDay(cursor), end: addDays(cursor, 60) };
  }, [view, cursor]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      // Fetch with wider range for recurrence base
      const fetchStart = addDays(range.start, -180);
      const fetchEnd = addDays(range.end, 30);
      const data = await calendarService.listEvents(fetchStart, fetchEnd);
      setEvents(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadEvents(); }, [range.start.getTime(), range.end.getTime()]);

  const expanded = useMemo(() => expandEvents(events, range.start, range.end), [events, range]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEventWithDetails[]>();
    for (const ev of expanded) {
      const key = startOfDay(new Date(ev.starts_at)).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [expanded]);

  const navigate = (dir: -1 | 1) => {
    const d = new Date(cursor);
    if (view === 'month') d.setMonth(d.getMonth() + dir);
    else if (view === 'week') d.setDate(d.getDate() + dir * 7);
    else if (view === 'day') d.setDate(d.getDate() + dir);
    else d.setMonth(d.getMonth() + dir);
    setCursor(d);
  };

  const openNew = (date?: Date) => {
    setSelectedEvent(null);
    setDefaultDate(date);
    setModalOpen(true);
  };

  const openEvent = (ev: CalendarEventWithDetails) => {
    // Find original (in case it's an expanded recurrence)
    const orig = events.find((e) => e.id === ev.id) || ev;
    setSelectedEvent(orig);
    setDefaultDate(undefined);
    setModalOpen(true);
  };

  const headerLabel = useMemo(() => {
    if (view === 'month') return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
    if (view === 'week') {
      const s = startOfWeek(cursor);
      const e = addDays(s, 6);
      return `${s.getDate()}/${s.getMonth() + 1} - ${e.getDate()}/${e.getMonth() + 1}/${e.getFullYear()}`;
    }
    if (view === 'day') return cursor.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return 'Próximos eventos';
  }, [view, cursor]);

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold">Agenda</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>Hoje</Button>
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
            <span className="font-medium px-2 capitalize min-w-[200px] text-center">{headerLabel}</span>
            <Button onClick={() => openNew()}><Plus className="h-4 w-4 mr-2" />Novo Evento</Button>
          </div>
        </div>

        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList>
            <TabsTrigger value="month">Mês</TabsTrigger>
            <TabsTrigger value="week">Semana</TabsTrigger>
            <TabsTrigger value="day">Dia</TabsTrigger>
            <TabsTrigger value="list">Lista</TabsTrigger>
          </TabsList>

          <TabsContent value="month">
            <Card className="p-2">
              <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="bg-muted p-2 text-center text-xs font-semibold uppercase">{d}</div>
                ))}
                {Array.from({ length: 42 }).map((_, i) => {
                  const day = addDays(range.start, i);
                  const isCurrentMonth = day.getMonth() === cursor.getMonth();
                  const isToday = sameDay(day, new Date());
                  const dayEvents = eventsByDay.get(day.toDateString()) || [];
                  return (
                    <div
                      key={i}
                      className={cn(
                        'bg-background min-h-[100px] p-1.5 cursor-pointer hover:bg-accent/50 transition',
                        !isCurrentMonth && 'opacity-40'
                      )}
                      onClick={() => openNew(day)}
                    >
                      <div className={cn(
                        'text-xs font-medium mb-1 inline-flex items-center justify-center w-6 h-6 rounded-full',
                        isToday && 'bg-primary text-primary-foreground'
                      )}>
                        {day.getDate()}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((ev, idx) => (
                          <div
                            key={`${ev.id}-${idx}`}
                            onClick={(e) => { e.stopPropagation(); openEvent(ev); }}
                            className="text-[11px] px-1.5 py-0.5 rounded truncate text-white font-medium"
                            style={{ background: ev.color }}
                          >
                            {!ev.all_day && `${formatTime(ev.starts_at)} `}{ev.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-[10px] text-muted-foreground">+{dayEvents.length - 3} mais</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="week">
            <Card className="p-2">
              <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                {Array.from({ length: 7 }).map((_, i) => {
                  const day = addDays(range.start, i);
                  const isToday = sameDay(day, new Date());
                  const dayEvents = eventsByDay.get(day.toDateString()) || [];
                  return (
                    <div key={i} className="bg-background min-h-[400px]">
                      <div
                        className={cn('p-2 text-center border-b cursor-pointer hover:bg-accent/50', isToday && 'bg-primary/10')}
                        onClick={() => openNew(day)}
                      >
                        <div className="text-xs uppercase text-muted-foreground">{WEEKDAYS[day.getDay()]}</div>
                        <div className={cn('text-lg font-semibold', isToday && 'text-primary')}>{day.getDate()}</div>
                      </div>
                      <div className="p-1 space-y-1">
                        {dayEvents.map((ev, idx) => (
                          <div
                            key={`${ev.id}-${idx}`}
                            onClick={() => openEvent(ev)}
                            className="text-xs p-1.5 rounded cursor-pointer text-white"
                            style={{ background: ev.color }}
                          >
                            <div className="font-semibold truncate">{ev.title}</div>
                            {!ev.all_day && <div className="opacity-90">{formatTime(ev.starts_at)}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="day">
            <Card className="p-4">
              {(eventsByDay.get(startOfDay(cursor).toDateString()) || []).length === 0 ? (
                <p className="text-center text-muted-foreground py-12">Nenhum evento neste dia. Clique em "Novo Evento" para criar.</p>
              ) : (
                <div className="space-y-2">
                  {(eventsByDay.get(startOfDay(cursor).toDateString()) || []).map((ev, idx) => (
                    <EventCard key={`${ev.id}-${idx}`} event={ev} onClick={() => openEvent(ev)} />
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="list">
            <Card className="p-4">
              {expanded.length === 0 && !loading && (
                <p className="text-center text-muted-foreground py-12">Nenhum evento próximo.</p>
              )}
              <div className="space-y-2">
                {expanded.map((ev, idx) => (
                  <EventCard key={`${ev.id}-${idx}`} event={ev} onClick={() => openEvent(ev)} showDate />
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <EventFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        event={selectedEvent}
        defaultDate={defaultDate}
        onSaved={loadEvents}
        canEdit={!selectedEvent || selectedEvent.created_by === user?.id}
      />
    </AdminLayout>
  );
};

const EventCard = ({ event, onClick, showDate }: { event: CalendarEventWithDetails; onClick: () => void; showDate?: boolean }) => (
  <div
    onClick={onClick}
    className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent/50 transition"
  >
    <div className="w-1 self-stretch rounded-full" style={{ background: event.color }} />
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <h4 className="font-semibold">{event.title}</h4>
        <Badge variant="outline" style={{ borderColor: event.color, color: event.color }}>
          {CATEGORY_LABELS[event.category]}
        </Badge>
      </div>
      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {showDate && `${formatDate(event.starts_at)} `}
          {event.all_day ? 'Dia inteiro' : `${formatTime(event.starts_at)} - ${formatTime(event.ends_at)}`}
        </span>
        {event.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{event.location}</span>}
        {event.link && <span className="flex items-center gap-1"><LinkIcon className="h-3.5 w-3.5" />Link</span>}
        {event.participants.length > 0 && (
          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{event.participants.length}</span>
        )}
      </div>
      {event.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{event.description}</p>}
    </div>
  </div>
);

export default CalendarPage;
