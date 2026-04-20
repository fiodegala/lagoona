import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Loader2, Trash2 } from 'lucide-react';
import {
  calendarService,
  type CalendarCategory,
  type CalendarEventWithDetails,
  type CalendarRecurrence,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
} from '@/services/calendar';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEventWithDetails | null;
  defaultDate?: Date;
  onSaved: () => void;
  canEdit?: boolean;
}

const REMINDER_OPTIONS = [
  { value: 5, label: '5 minutos antes' },
  { value: 15, label: '15 minutos antes' },
  { value: 30, label: '30 minutos antes' },
  { value: 60, label: '1 hora antes' },
  { value: 1440, label: '1 dia antes' },
];

const toInputDateTime = (iso: string) => {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
};

const fromInputDateTime = (s: string) => new Date(s).toISOString();

const EventFormModal = ({ open, onOpenChange, event, defaultDate, onSaved, canEdit = true }: Props) => {
  const isReadOnly = !!event && !canEdit;
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<{ user_id: string; full_name: string }[]>([]);
  const [participantSearch, setParticipantSearch] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [link, setLink] = useState('');
  const [category, setCategory] = useState<CalendarCategory>('meeting');
  const [color, setColor] = useState(CATEGORY_COLORS.meeting);
  const [allDay, setAllDay] = useState(false);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [recurrence, setRecurrence] = useState<CalendarRecurrence>('none');
  const [recurrenceUntil, setRecurrenceUntil] = useState('');
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [reminders, setReminders] = useState<number[]>([15]);

  const filteredUsers = users.filter((u) =>
    (u.full_name || '').toLowerCase().includes(participantSearch.toLowerCase())
  );
  const allFilteredSelected = filteredUsers.length > 0 && filteredUsers.every((u) => participantIds.includes(u.user_id));
  const toggleAllFiltered = () => {
    if (allFilteredSelected) {
      setParticipantIds((prev) => prev.filter((id) => !filteredUsers.some((u) => u.user_id === id)));
    } else {
      setParticipantIds((prev) => Array.from(new Set([...prev, ...filteredUsers.map((u) => u.user_id)])));
    }
  };

  useEffect(() => {
    if (!open) return;
    calendarService.listAdminUsers().then(setUsers).catch(() => setUsers([]));

    if (event) {
      setTitle(event.title);
      setDescription(event.description || '');
      setLocation(event.location || '');
      setLink(event.link || '');
      setCategory(event.category);
      setColor(event.color);
      setAllDay(event.all_day);
      setStartsAt(toInputDateTime(event.starts_at));
      setEndsAt(toInputDateTime(event.ends_at));
      setRecurrence(event.recurrence);
      setRecurrenceUntil(event.recurrence_until ? toInputDateTime(event.recurrence_until) : '');
      setParticipantIds(event.participants.map((p) => p.user_id));
      setReminders(event.reminders.map((r) => r.minutes_before));
    } else {
      const base = defaultDate ? new Date(defaultDate) : new Date();
      base.setMinutes(0, 0, 0);
      const end = new Date(base.getTime() + 60 * 60 * 1000);
      setTitle('');
      setDescription('');
      setLocation('');
      setLink('');
      setCategory('meeting');
      setColor(CATEGORY_COLORS.meeting);
      setAllDay(false);
      setStartsAt(toInputDateTime(base.toISOString()));
      setEndsAt(toInputDateTime(end.toISOString()));
      setRecurrence('none');
      setRecurrenceUntil('');
      setParticipantIds([]);
      setReminders([15]);
    }
  }, [open, event, defaultDate]);

  const handleCategoryChange = (c: CalendarCategory) => {
    setCategory(c);
    setColor(CATEGORY_COLORS[c]);
  };

  const toggleParticipant = (uid: string) => {
    setParticipantIds((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]
    );
  };

  const toggleReminder = (mins: number) => {
    setReminders((prev) =>
      prev.includes(mins) ? prev.filter((x) => x !== mins) : [...prev, mins]
    );
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({ title: 'Título obrigatório', variant: 'destructive' });
      return;
    }
    if (!startsAt || !endsAt) {
      toast({ title: 'Defina início e fim', variant: 'destructive' });
      return;
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      toast({ title: 'Fim deve ser após o início', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title: title.trim(),
        description,
        location,
        link,
        category,
        color,
        starts_at: fromInputDateTime(startsAt),
        ends_at: fromInputDateTime(endsAt),
        all_day: allDay,
        recurrence,
        recurrence_until: recurrence !== 'none' && recurrenceUntil ? fromInputDateTime(recurrenceUntil) : null,
        participant_ids: participantIds,
        reminder_minutes: reminders,
      };
      if (event) {
        await calendarService.updateEvent(event.id, payload);
        toast({ title: 'Evento atualizado' });
      } else {
        await calendarService.createEvent(payload);
        toast({ title: 'Evento criado' });
      }
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    if (!confirm('Excluir este evento?')) return;
    setLoading(true);
    try {
      await calendarService.deleteEvent(event.id);
      toast({ title: 'Evento excluído' });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Erro ao excluir', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {event ? (isReadOnly ? 'Detalhes do Evento' : 'Editar Evento') : 'Novo Evento'}
          </DialogTitle>
          {isReadOnly && (
            <p className="text-xs text-muted-foreground">Somente o criador pode editar este evento.</p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 -mr-2">
          <fieldset disabled={isReadOnly} className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Reunião com equipe" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoria</Label>
                <Select value={category} onValueChange={(v) => handleCategoryChange(v as CalendarCategory)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ background: CATEGORY_COLORS[k as CalendarCategory] }} />
                          {v}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cor</Label>
                <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={allDay} onCheckedChange={setAllDay} id="allday" />
              <Label htmlFor="allday">Dia inteiro</Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Início *</Label>
                <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </div>
              <div>
                <Label>Fim *</Label>
                <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Recorrência</Label>
                <Select value={recurrence} onValueChange={(v) => setRecurrence(v as CalendarRecurrence)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    <SelectItem value="daily">Diariamente</SelectItem>
                    <SelectItem value="weekly">Semanalmente</SelectItem>
                    <SelectItem value="monthly">Mensalmente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {recurrence !== 'none' && (
                <div>
                  <Label>Repetir até</Label>
                  <Input type="datetime-local" value={recurrenceUntil} onChange={(e) => setRecurrenceUntil(e.target.value)} />
                </div>
              )}
            </div>

            <div>
              <Label>Local</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Sala de reunião, endereço..." />
            </div>

            <div>
              <Label>Link (Meet, Zoom, etc.)</Label>
              <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." />
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>

            <div>
              <Label className="mb-2 block">Lembretes</Label>
              <div className="flex flex-wrap gap-2">
                {REMINDER_OPTIONS.map((opt) => (
                  <Badge
                    key={opt.value}
                    variant={reminders.includes(opt.value) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleReminder(opt.value)}
                  >
                    {opt.label}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <Label className="m-0">Participantes ({participantIds.length})</Label>
                {filteredUsers.length > 0 && !isReadOnly && (
                  <button
                    type="button"
                    onClick={toggleAllFiltered}
                    className="text-xs text-primary hover:underline"
                  >
                    {allFilteredSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Os participantes selecionados verão este evento em sua própria agenda.
              </p>
              <Input
                placeholder="Buscar usuário..."
                value={participantSearch}
                onChange={(e) => setParticipantSearch(e.target.value)}
                className="mb-2"
              />
              <div className="border rounded-md max-h-48 overflow-y-auto p-2 space-y-1">
                {filteredUsers.length === 0 && (
                  <p className="text-sm text-muted-foreground p-2">Nenhum usuário encontrado</p>
                )}
                {filteredUsers.map((u) => (
                  <label key={u.user_id} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer">
                    <Checkbox
                      checked={participantIds.includes(u.user_id)}
                      onCheckedChange={() => toggleParticipant(u.user_id)}
                    />
                    <span className="text-sm">{u.full_name || 'Sem nome'}</span>
                  </label>
                ))}
              </div>
            </div>
          </fieldset>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between gap-2 pt-4 border-t">
          <div>
            {event && canEdit && (
              <Button variant="destructive" onClick={handleDelete} disabled={loading}>
                <Trash2 className="h-4 w-4 mr-2" /> Excluir
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              {isReadOnly ? 'Fechar' : 'Cancelar'}
            </Button>
            {!isReadOnly && (
              <Button onClick={handleSubmit} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {event ? 'Salvar' : 'Criar Evento'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EventFormModal;
