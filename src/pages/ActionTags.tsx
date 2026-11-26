import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tags, BarChart3, CalendarIcon } from 'lucide-react';
import { format, startOfWeek, startOfMonth, endOfMonth, subDays, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AdminLayout from '@/components/AdminLayout';
import { ManageSaleActionTags } from '@/components/SaleActionTags';
import SaleActionTagsReport, { type ActionTaggedSale } from '@/components/dashboard/SaleActionTagsReport';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

type Period = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'custom';
const periods: { value: Period; label: string }[] = [
  { value: 'all', label: 'Todo o período' }, { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' }, { value: 'week', label: 'Essa semana' },
  { value: 'month', label: 'Este mês' }, { value: 'last_month', label: 'Mês passado' },
  { value: 'custom', label: 'Personalizado' },
];

export default function ActionTags() {
  const { user, isAdmin, managedStoreIds } = useAuth();
  const [tab, setTab] = useState('tags');
  const [period, setPeriod] = useState<Period>('all');
  const [storeId, setStoreId] = useState('all');
  const [from, setFrom] = useState<Date>();
  const [to, setTo] = useState<Date>();
  // Use the business calendar, not the device's timezone, for sale boundaries.
  const businessDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const today = new Date(`${businessDay}T12:00:00`);
  let first: Date | undefined;
  let last: Date | undefined;
  if (period === 'today') first = last = today;
  if (period === 'yesterday') first = last = subDays(today, 1);
  if (period === 'week') { first = startOfWeek(today, { weekStartsOn: 1 }); last = today; }
  if (period === 'month') { first = startOfMonth(today); last = today; }
  if (period === 'last_month') { first = startOfMonth(subMonths(today, 1)); last = endOfMonth(first); }
  if (period === 'custom') { first = from; last = to; }
  const fromDay = first ? format(first, 'yyyy-MM-dd') : '';
  const toDay = last ? format(last, 'yyyy-MM-dd') : '';
  const invalidRange = !!fromDay && !!toDay && fromDay > toDay;
  const scope = isAdmin ? null : (managedStoreIds ?? []);
  const stores = useQuery({
    queryKey: ['action-tag-stores', user?.id, scope],
    enabled: !!user,
    queryFn: async () => {
      if (scope && scope.length === 0) return [];
      let query = supabase.from('stores').select('id, name').order('name');
      if (scope) query = query.in('id', scope);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
  const sales = useQuery({
    queryKey: ['action-tag-results', user?.id, scope, storeId, fromDay, toDay],
    enabled: !!user && tab === 'results' && !invalidRange,
    queryFn: async () => {
      if (scope && scope.length === 0) return [];
      const result: ActionTaggedSale[] = [];
      for (let offset = 0; ; offset += 1000) {
        let query = supabase.from('pos_sales')
          .select('id, action_tag_id, total, customer_id, customer_name, status, sale_type')
          .eq('status', 'completed').not('action_tag_id', 'is', null)
          .order('created_at', { ascending: false }).order('id').range(offset, offset + 999);
        if (scope) query = query.in('store_id', scope);
        if (storeId !== 'all') query = query.eq('store_id', storeId);
        if (fromDay) query = query.gte('created_at', `${fromDay}T00:00:00-03:00`);
        if (toDay) query = query.lte('created_at', `${toDay}T23:59:59.999-03:00`);
        const { data, error } = await query;
        if (error) throw error;
        result.push(...(data ?? []));
        if (!data || data.length < 1000) return result;
      }
    },
  });
  return <AdminLayout>
    <div className="space-y-6">
      <header><h1 className="flex items-center gap-3 text-2xl font-bold"><Tags className="h-6 w-6 text-primary" />Etiquetas de ações</h1></header>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="tags"><Tags className="mr-2 h-4 w-4" />Etiquetas</TabsTrigger><TabsTrigger value="results"><BarChart3 className="mr-2 h-4 w-4" />Resultados</TabsTrigger></TabsList>
        <TabsContent value="tags" className="mt-6"><section className="max-w-2xl"><ManageSaleActionTags inline /></section></TabsContent>
        <TabsContent value="results" className="mt-6 space-y-6">
          <div className="flex flex-wrap gap-3">
            <Select value={period} onValueChange={value => setPeriod(value as Period)}><SelectTrigger aria-label="Período dos resultados" className="w-full sm:w-48"><SelectValue /></SelectTrigger><SelectContent>{periods.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
            <Select value={storeId} onValueChange={setStoreId}><SelectTrigger aria-label="Loja dos resultados" className="w-full sm:w-56"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as lojas</SelectItem>{(stores.data ?? []).map(store => <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>)}</SelectContent></Select>
            {period === 'custom' && ([{ date: from, setDate: setFrom, label: 'De' }, { date: to, setDate: setTo, label: 'Até' }].map(field => <Popover key={field.label}><PopoverTrigger asChild><Button variant="outline"><CalendarIcon className="mr-2 h-4 w-4" />{field.label}: {field.date ? format(field.date, 'dd/MM/yyyy') : 'Selecionar'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.date} onSelect={field.setDate} locale={ptBR} /></PopoverContent></Popover>))}
            <Button variant="outline" onClick={() => { void sales.refetch(); void stores.refetch(); }} disabled={sales.isFetching}>Atualizar</Button>
          </div>
          {stores.isError && <p role="alert" className="text-destructive">Não foi possível carregar as lojas.</p>}
          {invalidRange ? <p role="alert" className="text-destructive">A data inicial deve ser anterior à data final.</p> : sales.isError ? <p role="alert" className="text-destructive">Não foi possível carregar os resultados. <Button variant="link" onClick={() => void sales.refetch()}>Tentar novamente</Button></p> : <SaleActionTagsReport sales={sales.data ?? []} loading={sales.isLoading} cards />}
        </TabsContent>
      </Tabs>
    </div>
  </AdminLayout>;
}