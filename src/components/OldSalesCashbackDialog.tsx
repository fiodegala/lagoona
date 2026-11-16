import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Search, History } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  cashbackValue,
  formatBRL,
  formatDateBR,
  isSaleEligibleForCashback,
  latestSalePerCustomer,
  spDateKey,
  validityFromToday,
  type OldSale,
} from '@/lib/cashback';

interface Store { id: string; name: string; }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  stores: Store[];
  /** Lojas que o usuário pode usar; null = todas. */
  allowedStoreIds: string[] | null;
  settings: { percent: number; validity_days: number; sale_types: string[]; min_sale_value: number; enabled: boolean } | null | undefined;
}

const SALE_TYPE_LABEL: Record<string, string> = { varejo: 'Varejo', atacado: 'Atacado', exclusivo: 'Exclusivo' };

/** Início do dia em Brasília (AAAA-MM-DD) como ISO em UTC. */
const spDayStartISO = (key: string) => `${key}T03:00:00.000Z`;
const nextDayKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

const chunk = <T,>(arr: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

type Row = OldSale & { phone: string | null; store_name: string };

const OldSalesCashbackDialog = ({ open, onOpenChange, stores, allowedStoreIds, settings }: Props) => {
  const queryClient = useQueryClient();
  const [from, setFrom] = useState('2026-07-01');
  const [to, setTo] = useState('2026-11-11');
  const [storeId, setStoreId] = useState('all');
  const [search, setSearch] = useState('');
  const [latestOnly, setLatestOnly] = useState(true);
  const [fromToday, setFromToday] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const storeOptions = useMemo(
    () => (allowedStoreIds ? stores.filter((s) => allowedStoreIds.includes(s.id)) : stores),
    [stores, allowedStoreIds],
  );
  const storeName = useMemo(() => new Map(stores.map((s) => [s.id, s.name])), [stores]);

  const rules = useMemo(() => ({
    sale_types: settings?.sale_types || ['varejo'],
    min_sale_value: Number(settings?.min_sale_value || 0),
  }), [settings]);

  const { data: rows = [], isFetching, error } = useQuery({
    queryKey: ['cashback-old-sales', from, to, storeId, (allowedStoreIds || []).join(','), rules.sale_types.join(','), rules.min_sale_value],
    enabled: open && !!from && !!to && from <= to,
    queryFn: async (): Promise<Row[]> => {
      const sales: OldSale[] = [];
      for (let page = 0; page < 50; page++) {
        let q = supabase
          .from('pos_sales')
          .select('id, created_at, customer_id, customer_name, sale_type, status, total, store_id')
          .eq('status', 'completed')
          .not('customer_id', 'is', null)
          .gte('created_at', spDayStartISO(from))
          .lt('created_at', spDayStartISO(nextDayKey(to)))
          .order('created_at', { ascending: false })
          .range(page * 1000, page * 1000 + 999);
        if (storeId !== 'all') q = q.eq('store_id', storeId);
        else if (allowedStoreIds) q = q.in('store_id', allowedStoreIds.length ? allowedStoreIds : ['00000000-0000-0000-0000-000000000000']);
        const { data, error } = await q;
        if (error) throw error;
        sales.push(...((data || []) as OldSale[]));
        if (!data || data.length < 1000) break;
      }
      const eligible = sales.filter((s) => isSaleEligibleForCashback(s, rules));

      const existing = new Set<string>();
      for (const ids of chunk(eligible.map((s) => s.id), 200)) {
        const { data, error } = await supabase.from('cashback_reminders').select('sale_id').in('sale_id', ids);
        if (error) throw error;
        (data || []).forEach((r) => r.sale_id && existing.add(r.sale_id));
      }
      const fresh = eligible.filter((s) => !existing.has(s.id));

      const phones = new Map<string, string | null>();
      const customerIds = [...new Set(fresh.map((s) => s.customer_id!))];
      for (const ids of chunk(customerIds, 200)) {
        const { data } = await supabase.from('customers').select('id, phone, responsavel_telefone').in('id', ids);
        (data || []).forEach((c) => phones.set(c.id, c.phone || c.responsavel_telefone || null));
      }
      return fresh.map((s) => ({ ...s, phone: phones.get(s.customer_id!) ?? null, store_name: storeName.get(s.store_id || '') || '—' }));
    },
  });

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const digits = term.replace(/\D/g, '');
    let list = latestOnly ? latestSalePerCustomer(rows) : rows;
    if (term) {
      list = list.filter((r) =>
        (r.customer_name || '').toLowerCase().includes(term) ||
        (digits.length >= 3 && (r.phone || '').replace(/\D/g, '').includes(digits)),
      );
    }
    return list;
  }, [rows, latestOnly, search]);

  // Ao mudar filtros, mantém selecionadas só as vendas que continuam na lista.
  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(visible.map((r) => r.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [visible]);

  const percent = Number(settings?.percent || 0);
  const validityDays = Number(settings?.validity_days || 30);
  const chosen = visible.filter((r) => selected.has(r.id));
  const chosenCashback = chosen.reduce((s, r) => s + cashbackValue(Number(r.total), percent), 0);
  const allChecked = visible.length > 0 && chosen.length === visible.length;

  const toggleAll = (on: boolean) => setSelected(on ? new Set(visible.map((r) => r.id)) : new Set());
  const toggleOne = (id: string, on: boolean) => setSelected((prev) => {
    const next = new Set(prev);
    if (on) next.add(id); else next.delete(id);
    return next;
  });

  const create = async () => {
    if (chosen.length === 0) return;
    setSaving(true);
    let created = 0;
    try {
      for (const ids of chunk(chosen.map((r) => r.id), 100)) {
        const { data, error } = await supabase.rpc('create_cashback_reminders_from_sales', {
          _sale_ids: ids,
          _validity_from_today: fromToday,
        });
        if (error) throw error;
        created += Number(data || 0);
      }
      toast.success(`${created} aviso(s) de cashback criado(s)`);
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ['cashback-old-sales'] });
      queryClient.invalidateQueries({ queryKey: ['cashback-reminders-admin'] });
      queryClient.invalidateQueries({ queryKey: ['cashback-due-reminders'] });
      onOpenChange(false);
    } catch (e) {
      toast.error('Não foi possível criar os avisos: ' + (e as Error).message);
      if (created) queryClient.invalidateQueries({ queryKey: ['cashback-reminders-admin'] });
    } finally {
      setSaving(false);
    }
  };

  const validityLabel = fromToday
    ? `até ${formatDateBR(validityFromToday(validityDays))} (${validityDays} dias a partir de hoje)`
    : `${validityDays} dias a partir da data de cada compra`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5 text-primary" /> Cashback para compras antigas</DialogTitle>
          <DialogDescription>
            Escolha clientes que compraram antes do cashback existir. Os avisos seguem as regras atuais ({percent}% • {rules.sale_types.map((t) => SALE_TYPE_LABEL[t] || t).join(', ')}) e aparecem para quem recebe a partir de agora.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto overscroll-contain pr-1">
          {settings && !settings.enabled && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">O cashback está desligado em Regras. Ligue antes de criar avisos.</div>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="old-from">Compras de</Label>
              <Input id="old-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="old-to">até</Label>
              <Input id="old-to" type="date" value={to} min={from} max={spDateKey(new Date())} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <Label>Loja</Label>
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{allowedStoreIds ? 'Todas as minhas lojas' : 'Todas as lojas'}</SelectItem>
                  {storeOptions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <Label htmlFor="old-search">Cliente</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input id="old-search" className="pl-8" placeholder="Nome ou telefone" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <label className="flex items-center gap-2">
              <Switch checked={latestOnly} onCheckedChange={setLatestOnly} />
              Só a compra mais recente de cada cliente
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={fromToday} onCheckedChange={setFromToday} />
              Contar a validade a partir de hoje
            </label>
          </div>
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            Validade do cashback: <strong>{validityLabel}</strong>
            {!fromToday && <span className="text-destructive"> — compras com mais de {validityDays} dias já vencem e o aviso não aparece.</span>}
          </div>

          {error ? (
            <p className="text-sm text-destructive">Erro ao buscar vendas: {(error as Error).message}</p>
          ) : isFetching ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={allChecked} onCheckedChange={(v) => toggleAll(!!v)} aria-label="Selecionar todas" />
                    </TableHead>
                    <TableHead>Compra</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Cashback</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma compra sem aviso neste período.</TableCell></TableRow>
                  )}
                  {visible.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => toggleOne(r.id, !selected.has(r.id))}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selected.has(r.id)} onCheckedChange={(v) => toggleOne(r.id, !!v)} aria-label={`Selecionar ${r.customer_name}`} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateBR(r.created_at)}</TableCell>
                      <TableCell>
                        <div className="font-medium">{r.customer_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.phone || <span className="text-destructive">sem telefone</span>}
                          {r.sale_type && r.sale_type !== 'varejo' && <Badge variant="outline" className="ml-2">{SALE_TYPE_LABEL[r.sale_type] || r.sale_type}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>{r.store_name}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatBRL(r.total)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap font-semibold">{formatBRL(cashbackValue(Number(r.total), percent))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t pt-3">
          <p className="text-sm text-muted-foreground">
            {visible.length} compra(s) sem aviso • {chosen.length} selecionada(s) • {formatBRL(chosenCashback)} em cashback
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={create} disabled={saving || chosen.length === 0 || (settings ? !settings.enabled : true)}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar {chosen.length || ''} aviso(s)
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OldSalesCashbackDialog;
