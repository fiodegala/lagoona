import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Gift, Loader2, MessageCircle, Check, RotateCcw, Save, Search } from 'lucide-react';
import { toast } from 'sonner';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  buildCashbackMessage,
  DEFAULT_CASHBACK_TEMPLATE,
  formatBRL,
  formatDateBR,
  whatsappLink,
  cashbackValue,
  cashbackMinNextPurchase,
  type CashbackReminder,
} from '@/lib/cashback';

const SALE_TYPES = [
  { value: 'varejo', label: 'Varejo' },
  { value: 'atacado', label: 'Atacado' },
  { value: 'exclusivo', label: 'Exclusivo' },
];

const STATUS_LABEL: Record<string, string> = { pending: 'Pendente', sent: 'Enviado', cancelled: 'Venda cancelada' };

interface Store { id: string; name: string; }

const useStores = () =>
  useQuery({
    queryKey: ['cashback-stores'],
    queryFn: async () => {
      const { data } = await supabase.from('stores').select('id, name').eq('is_active', true).order('name');
      return (data || []) as Store[];
    },
  });

const useTemplate = () =>
  useQuery({
    queryKey: ['cashback-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cashback_settings').select('*').eq('id', 1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

/* ---------------- Avisos ---------------- */
const RemindersTab = () => {
  const queryClient = useQueryClient();
  const { data: stores = [] } = useStores();
  const { data: settings } = useTemplate();
  const [status, setStatus] = useState('pending');
  const [storeId, setStoreId] = useState('all');
  const [search, setSearch] = useState('');

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['cashback-reminders-admin', status, storeId],
    queryFn: async () => {
      let q = supabase.from('cashback_reminders').select('*').order('sale_date', { ascending: false }).limit(1000);
      if (status !== 'all') q = q.eq('status', status);
      if (storeId !== 'all') q = q.eq('store_id', storeId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as CashbackReminder[];
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const digits = term.replace(/\D/g, '');
    if (!term) return reminders;
    return reminders.filter((r) =>
      (r.customer_name || '').toLowerCase().includes(term) ||
      (digits && ((r.customer_phone || '').replace(/\D/g, '').includes(digits) || (r.customer_document || '').replace(/\D/g, '').includes(digits))),
    );
  }, [reminders, search]);

  const totals = useMemo(() => ({
    count: filtered.length,
    cashback: filtered.reduce((s, r) => s + Number(r.cashback_value || 0), 0),
  }), [filtered]);

  const setReminderStatus = async (r: CashbackReminder, next: 'sent' | 'pending') => {
    const { error } = await supabase.rpc('set_cashback_reminder_status', { _reminder_id: r.id, _status: next });
    if (error) return toast.error(error.message);
    toast.success(next === 'sent' ? 'Marcado como enviado' : 'Aviso reaberto');
    queryClient.invalidateQueries({ queryKey: ['cashback-reminders-admin'] });
    queryClient.invalidateQueries({ queryKey: ['cashback-due-reminders'] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Avisos de cashback</CardTitle>
        <CardDescription>
          Cada venda do PDV com cliente cadastrado gera um aviso. Ele aparece para os usuários escolhidos a partir do dia seguinte, até alguém marcar como enviado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar cliente, telefone ou CPF" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="sent">Enviados</SelectItem>
              <SelectItem value="cancelled">Vendas canceladas</SelectItem>
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
        </div>
        <p className="text-sm text-muted-foreground">
          {totals.count} aviso(s) • {formatBRL(totals.cashback)} em cashback
        </p>

        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Compra</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Loja</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Cashback</TableHead>
                  <TableHead>Válido até</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum aviso encontrado.</TableCell></TableRow>
                )}
                {filtered.map((r) => {
                  const link = whatsappLink(r.customer_phone, buildCashbackMessage(settings?.message_template || DEFAULT_CASHBACK_TEMPLATE, r));
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{formatDateBR(r.sale_date)}</TableCell>
                      <TableCell>
                        <div className="font-medium">{r.customer_name}</div>
                        <div className="text-xs text-muted-foreground">{r.customer_phone || 'sem telefone'}</div>
                      </TableCell>
                      <TableCell>{r.store_name}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatBRL(r.sale_total)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap font-semibold">{formatBRL(r.cashback_value)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateBR(r.expires_at)}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === 'pending' ? 'default' : r.status === 'sent' ? 'secondary' : 'outline'}>
                          {STATUS_LABEL[r.status]}
                        </Badge>
                        {r.sent_at && <div className="text-xs text-muted-foreground mt-0.5">{formatDateBR(r.sent_at)}</div>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {link && r.status !== 'cancelled' && (
                            <Button size="icon" variant="ghost" asChild title="Abrir WhatsApp">
                              <a href={link} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" /></a>
                            </Button>
                          )}
                          {r.status === 'pending' && (
                            <Button size="sm" variant="outline" onClick={() => setReminderStatus(r, 'sent')}>
                              <Check className="h-4 w-4 mr-1" /> Enviado
                            </Button>
                          )}
                          {r.status === 'sent' && (
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
    </Card>
  );
};

/* ---------------- Regras ---------------- */
const RulesTab = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useTemplate();
  const [form, setForm] = useState({
    enabled: true, percent: '10', min_sale_value: '0', min_use_value: '150', validity_days: '30',
    min_use_mode: 'proportional', max_cover_percent: '15',
    sale_types: ['varejo'] as string[], message_template: DEFAULT_CASHBACK_TEMPLATE,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setForm({
      enabled: settings.enabled,
      percent: String(settings.percent),
      min_sale_value: String(settings.min_sale_value),
      min_use_value: String(settings.min_use_value),
      min_use_mode: settings.min_use_mode,
      max_cover_percent: String(settings.max_cover_percent),
      validity_days: String(settings.validity_days),
      sale_types: settings.sale_types || [],
      message_template: settings.message_template,
    });
  }, [settings]);

  const toNum = (v: string) => Number(String(v).replace(',', '.'));

  const save = async () => {
    const percent = toNum(form.percent);
    const minSale = toNum(form.min_sale_value);
    const minUse = toNum(form.min_use_value);
    const cover = toNum(form.max_cover_percent);
    if (form.min_use_mode === 'proportional' && !(cover > 0 && cover <= 100)) return toast.error('O limite da próxima compra precisa ficar entre 0 e 100%.');
    const days = Math.round(toNum(form.validity_days));
    if (!(percent > 0 && percent <= 100)) return toast.error('O percentual precisa ficar entre 0 e 100.');
    if (!(minSale >= 0) || !(minUse >= 0)) return toast.error('Valores mínimos inválidos.');
    if (!(days >= 1)) return toast.error('A validade precisa ser de pelo menos 1 dia.');
    if (form.sale_types.length === 0) return toast.error('Escolha pelo menos uma modalidade.');
    setSaving(true);
    const { error } = await supabase.from('cashback_settings').upsert({
      id: 1, enabled: form.enabled, percent, min_sale_value: minSale, min_use_value: minUse, min_use_mode: form.min_use_mode, max_cover_percent: form.min_use_mode === 'proportional' ? cover : (settings?.max_cover_percent ?? 15), validity_days: days,
      sale_types: form.sale_types, message_template: form.message_template || DEFAULT_CASHBACK_TEMPLATE,
      updated_at: new Date().toISOString(), updated_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Regras salvas. Valem para as próximas vendas.');
    queryClient.invalidateQueries({ queryKey: ['cashback-settings'] });
    queryClient.invalidateQueries({ queryKey: ['cashback-template'] });
  };

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const pct = toNum(form.percent) || 0;
  const exampleCash = cashbackValue(1000, pct);
  const exampleMin = form.min_use_mode === 'proportional'
    ? cashbackMinNextPurchase(exampleCash, toNum(form.max_cover_percent) || 15)
    : toNum(form.min_use_value);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Regras do cashback</CardTitle>
        <CardDescription>
          As regras valem para as vendas feitas depois de salvar. Os avisos que já existem mantêm as regras do dia da compra.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 max-w-2xl">
        <div className="flex items-center gap-3">
          <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} id="cb-enabled" />
          <Label htmlFor="cb-enabled">Gerar avisos de cashback nas novas vendas</Label>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Cashback (% do valor da compra)</Label>
            <Input inputMode="decimal" value={form.percent} onChange={(e) => setForm({ ...form, percent: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Validade (dias após a compra)</Label>
            <Input inputMode="numeric" value={form.validity_days} onChange={(e) => setForm({ ...form, validity_days: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Compra mínima para usar o cashback</Label>
            <Select value={form.min_use_mode} onValueChange={(v) => setForm({ ...form, min_use_mode: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="proportional">Proporcional ao cashback</SelectItem>
                <SelectItem value="fixed">Valor fixo</SelectItem>
              </SelectContent>
            </Select>
            {form.min_use_mode === 'proportional' ? (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">O cashback cobre no máximo (% da próxima compra)</Label>
                <Input inputMode="decimal" value={form.max_cover_percent} onChange={(e) => setForm({ ...form, max_cover_percent: e.target.value })} />
                <p className="text-xs text-muted-foreground">Arredondado para cima em reais inteiros.</p>
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Usar em compras acima de (R$)</Label>
                <Input inputMode="decimal" value={form.min_use_value} onChange={(e) => setForm({ ...form, min_use_value: e.target.value })} />
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Compra mínima para gerar (R$)</Label>
            <Input inputMode="decimal" value={form.min_sale_value} onChange={(e) => setForm({ ...form, min_sale_value: e.target.value })} />
            <p className="text-xs text-muted-foreground">Use 0 para gerar em qualquer valor.</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Modalidades que geram cashback</Label>
          <div className="flex flex-wrap gap-4">
            {SALE_TYPES.map((t) => (
              <label key={t.value} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.sale_types.includes(t.value)}
                  onCheckedChange={(v) => setForm({
                    ...form,
                    sale_types: v ? [...form.sale_types, t.value] : form.sale_types.filter((x) => x !== t.value),
                  })}
                />
                {t.label}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Trocas, brindes, vendas canceladas e "Consumidor Final" nunca geram.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Mensagem do WhatsApp</Label>
          <Textarea rows={6} value={form.message_template} onChange={(e) => setForm({ ...form, message_template: e.target.value })} />
          <p className="text-xs text-muted-foreground">
            Campos automáticos: {'{nome}'}, {'{nome_completo}'}, {'{loja}'}, {'{data_compra}'}, {'{valor_compra}'}, {'{cashback}'}, {'{compra_minima}'}, {'{validade}'}
          </p>
        </div>
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          Exemplo: uma compra de {formatBRL(1000)} gera {formatBRL(exampleCash)} de cashback, para usar em compras a partir de {formatBRL(exampleMin)}, válido por {form.validity_days} dias.
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar regras
        </Button>
      </CardContent>
    </Card>
  );
};

/* ---------------- Quem recebe ---------------- */
interface Viewer { user_id: string; all_stores: boolean; store_ids: string[]; }

const ViewersTab = () => {
  const queryClient = useQueryClient();
  const { data: stores = [] } = useStores();

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['cashback-staff'],
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id');
      const ids = [...new Set((roles || []).map((r) => r.user_id))];
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ids);
      return (profiles || [])
        .map((p) => ({ user_id: p.user_id, name: p.full_name || 'Sem nome' }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    },
  });

  const { data: viewers = [] } = useQuery({
    queryKey: ['cashback-viewers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cashback_viewers').select('user_id, all_stores, store_ids');
      if (error) throw error;
      return (data || []) as Viewer[];
    },
  });

  const viewerMap = useMemo(() => new Map(viewers.map((v) => [v.user_id, v])), [viewers]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['cashback-viewers'] });
    queryClient.invalidateQueries({ queryKey: ['cashback-viewer'] });
  };

  const saveViewer = async (v: Viewer) => {
    const { error } = await supabase.from('cashback_viewers').upsert({ ...v, updated_at: new Date().toISOString() });
    if (error) return toast.error(error.message);
    refresh();
  };

  const toggleUser = async (userId: string, on: boolean) => {
    if (on) {
      await saveViewer({ user_id: userId, all_stores: true, store_ids: [] });
      toast.success('Usuário passa a receber os avisos');
    } else {
      const { error } = await supabase.from('cashback_viewers').delete().eq('user_id', userId);
      if (error) return toast.error(error.message);
      toast.success('Usuário não recebe mais os avisos');
      refresh();
    }
  };

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quem recebe os avisos</CardTitle>
        <CardDescription>Ligue os usuários que devem ver o aviso e marque de quais lojas cada um vê as vendas.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {staff.map((u) => {
          const v = viewerMap.get(u.user_id);
          return (
            <div key={u.user_id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{u.name}</span>
                <Switch checked={!!v} onCheckedChange={(on) => toggleUser(u.user_id, on)} aria-label={`Avisos de cashback para ${u.name}`} />
              </div>
              {v && (
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  <label className="flex items-center gap-2 font-medium">
                    <Checkbox checked={v.all_stores} onCheckedChange={(c) => saveViewer({ ...v, all_stores: !!c })} />
                    Todas as lojas
                  </label>
                  {!v.all_stores && stores.map((s) => (
                    <label key={s.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={v.store_ids.includes(s.id)}
                        onCheckedChange={(c) => saveViewer({
                          ...v,
                          store_ids: c ? [...v.store_ids, s.id] : v.store_ids.filter((x) => x !== s.id),
                        })}
                      />
                      {s.name}
                    </label>
                  ))}
                  {!v.all_stores && v.store_ids.length === 0 && (
                    <span className="text-destructive text-xs">Marque pelo menos uma loja</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

const CashbackReminders = () => {
  const { isAdmin } = useAuth();
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Gift className="h-6 w-6 text-primary" /> Cashback</h1>
          <p className="text-muted-foreground">Lembretes para mandar o cashback dos clientes no WhatsApp.</p>
        </div>
        <Tabs defaultValue="avisos">
          <TabsList>
            <TabsTrigger value="avisos">Avisos</TabsTrigger>
            {isAdmin && <TabsTrigger value="regras">Regras</TabsTrigger>}
            {isAdmin && <TabsTrigger value="usuarios">Quem recebe</TabsTrigger>}
          </TabsList>
          <TabsContent value="avisos"><RemindersTab /></TabsContent>
          {isAdmin && <TabsContent value="regras"><RulesTab /></TabsContent>}
          {isAdmin && <TabsContent value="usuarios"><ViewersTab /></TabsContent>}
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default CashbackReminders;
