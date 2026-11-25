import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Cake, Loader2, MessageCircle, Check, RotateCcw, Search, Eye, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import AdminLayout from '@/components/AdminLayout';
import BirthdayReminderView from '@/components/BirthdayReminderView';
import { BirthdayRulesTab, BirthdayViewersTab, useBirthdaySettings, useBirthdayStores } from '@/components/BirthdaySettingsTabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDateBR, whatsappLink } from '@/lib/cashback';
import {
  BIRTHDAY_PERIOD_OPTIONS,
  birthdayPeriodRange,
  buildBirthdayMessage,
  fetchAllBirthdayReminders,
  formatDayMonthBR,
  isBirthdayToday,
  type BirthdayPeriodKey,
  type BirthdayReminder,
} from '@/lib/birthdays';

const STATUS_LABEL: Record<string, string> = { pending: 'Pendente', sent: 'Enviado' };

const RemindersTab = () => {
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuth();
  const { data: myViewer, isLoading: viewerLoading } = useQuery({
    queryKey: ['birthday-viewer', user?.id],
    enabled: !!user && !isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from('birthday_viewers')
        .select('user_id, all_stores, store_ids')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data;
    },
  });
  const notReleased = !isAdmin && !viewerLoading && !myViewer;

  const { data: stores = [] } = useBirthdayStores();
  const { data: settings } = useBirthdaySettings();
  const [status, setStatus] = useState<'pending' | 'sent' | 'all'>('pending');
  const [storeId, setStoreId] = useState('all');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<BirthdayPeriodKey>('month');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [preview, setPreview] = useState<BirthdayReminder | null>(null);
  const [previewMessage, setPreviewMessage] = useState('');
  const [previewSaving, setPreviewSaving] = useState(false);

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['birthday-reminders-admin', user?.id],
    enabled: !!user,
    queryFn: () => fetchAllBirthdayReminders(null, false),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const digits = term.replace(/\D/g, '');
    const { from, to } = birthdayPeriodRange(period, new Date(), customFrom, customTo);
    return reminders.filter((r) => {
      if (status !== 'all' && r.status !== status) return false;
      if (storeId !== 'all' && r.store_id !== storeId) return false;
      const day = r.birthday_date.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (!term) return true;
      return (
        (r.customer_name || '').toLowerCase().includes(term) ||
        (digits &&
          ((r.customer_phone || '').replace(/\D/g, '').includes(digits) ||
            (r.customer_document || '').replace(/\D/g, '').includes(digits)))
      );
    });
  }, [reminders, status, storeId, search, period, customFrom, customTo]);

  const todayCount = useMemo(() => filtered.filter((r) => isBirthdayToday(r.birthday_date)).length, [filtered]);

  const openPreview = (r: BirthdayReminder) => {
    setPreview(r);
    setPreviewMessage(buildBirthdayMessage(settings?.message_template, r));
  };

  const setReminderStatus = async (r: BirthdayReminder, next: 'sent' | 'pending') => {
    const { error } = await supabase.rpc('set_birthday_reminder_status', {
      _customer_id: r.customer_id,
      _year: r.birthday_year,
      _status: next,
    });
    if (error) { toast.error(error.message); return false; }
    toast.success(next === 'sent' ? 'Marcado como enviado' : 'Aviso reaberto');
    queryClient.invalidateQueries({ queryKey: ['birthday-reminders-admin'] });
    queryClient.invalidateQueries({ queryKey: ['birthday-due-reminders'] });
    return true;
  };

  const markPreviewSent = async () => {
    if (!preview) return;
    setPreviewSaving(true);
    const ok = await setReminderStatus(preview, 'sent');
    setPreviewSaving(false);
    if (ok) setPreview(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aniversariantes</CardTitle>
        <CardDescription>
          Clientes com data de nascimento cadastrada. O pop-up aparece automaticamente para os usuários liberados no dia do aniversário até alguém marcar como enviado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {notReleased && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            Você ainda não foi liberado para ver os aniversariantes. Peça a um administrador para ligar seu nome em <strong>Aniversariantes → Quem recebe</strong> e marcar suas lojas.
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar cliente, telefone ou CPF" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as 'pending' | 'sent' | 'all')}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="sent">Enviados</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={storeId} onValueChange={setStoreId}>
            <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as lojas</SelectItem>
              {stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => setPeriod(v as BirthdayPeriodKey)}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {BIRTHDAY_PERIOD_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {period === 'custom' && (
            <div className="flex items-center gap-1.5">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-[130px] justify-start text-left font-normal', !customFrom && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customFrom ? format(customFrom, 'dd/MM/yyyy') : 'De'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <span className="text-xs text-muted-foreground">até</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-[130px] justify-start text-left font-normal', !customTo && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customTo ? format(customTo, 'dd/MM/yyyy') : 'Até'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customTo} onSelect={setCustomTo} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Clique no cliente para ver como o pop-up vai aparecer. • {filtered.length} aniversariante(s)
          {todayCount > 0 ? ` • ${todayCount} hoje` : ''}
        </p>

        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aniversário</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Loja</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum aniversariante encontrado.</TableCell></TableRow>
                )}
                {filtered.map((r) => {
                  const link = whatsappLink(r.customer_phone, buildBirthdayMessage(settings?.message_template, r));
                  const today = isBirthdayToday(r.birthday_date);
                  return (
                    <TableRow key={`${r.customer_id}:${r.birthday_year}`} className="cursor-pointer" onClick={() => openPreview(r)} title="Ver como fica o pop-up">
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatDayMonthBR(r.birthday_date)}</span>
                          {today && <Badge>Hoje</Badge>}
                        </div>
                        {r.turning_age > 0 && <div className="text-xs text-muted-foreground">Faz {r.turning_age} anos</div>}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{r.customer_name}</div>
                        <div className="text-xs text-muted-foreground">{r.customer_phone || 'sem telefone'}</div>
                      </TableCell>
                      <TableCell>{r.store_name || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === 'pending' ? 'default' : 'secondary'}>
                          {STATUS_LABEL[r.status]}
                        </Badge>
                        {r.sent_at && <div className="text-xs text-muted-foreground mt-0.5">{formatDateBR(r.sent_at)}</div>}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openPreview(r)} title="Ver pop-up" aria-label={`Ver pop-up de ${r.customer_name}`}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {link && (
                            <Button size="icon" variant="ghost" asChild title="Abrir WhatsApp">
                              <a href={link} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" /></a>
                            </Button>
                          )}
                          {r.status === 'pending' ? (
                            <Button size="sm" variant="outline" onClick={() => setReminderStatus(r, 'sent')}>
                              <Check className="h-4 w-4 mr-1" /> Enviado
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => setReminderStatus(r, 'pending')}>
                              <RotateCcw className="h-4 w-4 mr-1" /> Reabrir
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!preview} onOpenChange={(v) => { if (!v) setPreview(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {preview && (
            <>
              <div className="-mt-2 mb-1 rounded-md border border-dashed bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground text-center">
                Pré-visualização • é assim que o aviso aparece para quem recebe
                {preview.status !== 'pending' && <> • este aviso está <strong>{STATUS_LABEL[preview.status]?.toLowerCase()}</strong></>}
              </div>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Cake className="h-5 w-5 text-primary" />
                  Aniversariante para parabenizar no WhatsApp
                </DialogTitle>
                <DialogDescription>1 aniversariante para avisar</DialogDescription>
              </DialogHeader>
              <BirthdayReminderView
                reminder={preview}
                message={previewMessage}
                onMessageChange={setPreviewMessage}
                giftImageUrl={settings?.gift_image_url}
                onMarkSent={preview.status === 'pending' ? markPreviewSent : undefined}
                saving={previewSaving}
                footer={
                  <div className="flex justify-between">
                    <Button variant="ghost" size="sm" onClick={() => setPreviewMessage(buildBirthdayMessage(settings?.message_template, preview))}>
                      <RotateCcw className="h-4 w-4 mr-1" /> Restaurar mensagem
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>Fechar</Button>
                  </div>
                }
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

const BirthdayReminders = () => {
  const { isAdmin } = useAuth();
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Cake className="h-6 w-6 text-primary" /> Aniversariantes</h1>
          <p className="text-muted-foreground">Lembretes para parabenizar os clientes aniversariantes no WhatsApp.</p>
        </div>
        <Tabs defaultValue="avisos">
          <TabsList>
            <TabsTrigger value="avisos">Avisos</TabsTrigger>
            {isAdmin && <TabsTrigger value="regras">Regras</TabsTrigger>}
            {isAdmin && <TabsTrigger value="usuarios">Quem recebe</TabsTrigger>}
          </TabsList>
          <TabsContent value="avisos"><RemindersTab /></TabsContent>
          {isAdmin && <TabsContent value="regras"><BirthdayRulesTab /></TabsContent>}
          {isAdmin && <TabsContent value="usuarios"><BirthdayViewersTab /></TabsContent>}
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default BirthdayReminders;