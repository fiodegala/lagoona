import { useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Download, Loader2, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { computeDateRange, type PeriodFilter } from '@/lib/dateRange';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Row {
  date: string;
  source: 'PDV' | 'Site';
  saleId: string;
  customerName: string;
  phone: string;
  email: string;
  productName: string;
  variation: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

const norm = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const CustomerPurchasesByProduct = () => {
  const [product, setProduct] = useState('');
  const [period, setPeriod] = useState<PeriodFilter>('30days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const runSearch = async () => {
    if (!product.trim()) {
      toast.error('Informe o nome (ou parte) do produto');
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const { start, end } = computeDateRange(period, customStart, customEnd);
      const startIso = start.toISOString();
      const endIso = end.toISOString();
      const needle = norm(product);

      const [posRes, ordRes] = await Promise.all([
        supabase
          .from('pos_sales')
          .select('id, created_at, customer_name, customer_phone, customer_email, items, status')
          .gte('created_at', startIso)
          .lte('created_at', endIso)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false }),
        supabase
          .from('orders')
          .select('id, created_at, customer_name, customer_phone, customer_email, items, status')
          .gte('created_at', startIso)
          .lte('created_at', endIso)
          .in('status', ['confirmed', 'processing', 'shipped', 'delivered', 'completed', 'paid'])
          .order('created_at', { ascending: false }),
      ]);

      if (posRes.error) throw posRes.error;
      if (ordRes.error) throw ordRes.error;

      const collected: Row[] = [];

      const scan = (list: any[], source: 'PDV' | 'Site') => {
        for (const s of list || []) {
          const items = Array.isArray(s.items) ? s.items : [];
          for (const it of items) {
            const name: string = it?.name || it?.product_name || '';
            if (!norm(name).includes(needle)) continue;
            const qty = Number(it?.quantity || it?.qty || 1);
            const unit = Number(it?.price || it?.unit_price || 0);
            collected.push({
              date: s.created_at,
              source,
              saleId: s.id,
              customerName: s.customer_name || '-',
              phone: s.customer_phone || '',
              email: s.customer_email || '',
              productName: name,
              variation: it?.variation_name || it?.variation || it?.sku || '',
              quantity: qty,
              unitPrice: unit,
              total: unit * qty,
            });
          }
        }
      };

      scan(posRes.data || [], 'PDV');
      scan(ordRes.data || [], 'Site');

      collected.sort((a, b) => (a.date < b.date ? 1 : -1));
      setRows(collected);
      if (collected.length === 0) toast.info('Nenhuma compra encontrada no período');
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao buscar: ' + (e.message || 'desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (!rows.length) return;
    const header = ['Data', 'Origem', 'Cliente', 'Telefone', 'Email', 'Produto', 'Variação', 'Qtd', 'Valor Unit.', 'Total', 'ID Venda'];
    const lines = rows.map((r) => [
      format(new Date(r.date), 'dd/MM/yyyy HH:mm'),
      r.source,
      r.customerName,
      r.phone,
      r.email,
      r.productName,
      r.variation,
      r.quantity,
      r.unitPrice.toFixed(2).replace('.', ','),
      r.total.toFixed(2).replace('.', ','),
      r.saleId,
    ]);
    const csv = [header, ...lines]
      .map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compras-${norm(product).replace(/\s+/g, '-')}-${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalQty = rows.reduce((s, r) => s + r.quantity, 0);
  const totalValue = rows.reduce((s, r) => s + r.total, 0);
  const uniqueCustomers = new Set(rows.map((r) => norm(r.customerName) + '|' + r.phone)).size;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Package className="h-7 w-7" /> Compras por Produto
          </h1>
          <p className="text-muted-foreground">
            Filtre clientes que compraram um produto específico em um período (PDV + Site).
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Busca por nome (parcial) do produto</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[1fr_200px_auto]">
              <div>
                <label className="text-sm font-medium mb-1 block">Produto</label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Ex: GOLA MÉDIA, CAMISETA TECH..."
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Período</label>
                <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Hoje</SelectItem>
                    <SelectItem value="yesterday">Ontem</SelectItem>
                    <SelectItem value="week">Esta semana</SelectItem>
                    <SelectItem value="month">Este mês</SelectItem>
                    <SelectItem value="30days">Últimos 30 dias</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={runSearch} disabled={loading} className="w-full md:w-auto">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                  Buscar
                </Button>
              </div>
            </div>
            {period === 'custom' && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium mb-1 block">De</label>
                  <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Até</label>
                  <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {searched && (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Vendas</div><div className="text-2xl font-bold">{rows.length}</div></CardContent></Card>
              <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Clientes únicos</div><div className="text-2xl font-bold">{uniqueCustomers}</div></CardContent></Card>
              <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Qtd total</div><div className="text-2xl font-bold">{totalQty}</div></CardContent></Card>
              <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Valor total</div><div className="text-2xl font-bold">{fmtBRL(totalValue)}</div></CardContent></Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Resultados ({rows.length})</CardTitle>
                <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
                  <Download className="h-4 w-4 mr-2" /> Exportar CSV
                </Button>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Produto / Variação</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={r.saleId + '-' + i}>
                        <TableCell className="whitespace-nowrap">{format(new Date(r.date), 'dd/MM/yy HH:mm')}</TableCell>
                        <TableCell><Badge variant={r.source === 'PDV' ? 'default' : 'secondary'}>{r.source}</Badge></TableCell>
                        <TableCell className="font-medium">{r.customerName}</TableCell>
                        <TableCell>{r.phone}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{r.email}</TableCell>
                        <TableCell>
                          <div>{r.productName}</div>
                          {r.variation && <div className="text-xs text-muted-foreground">{r.variation}</div>}
                        </TableCell>
                        <TableCell className="text-right">{r.quantity}</TableCell>
                        <TableCell className="text-right">{fmtBRL(r.total)}</TableCell>
                      </TableRow>
                    ))}
                    {!rows.length && !loading && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum resultado</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default CustomerPurchasesByProduct;
