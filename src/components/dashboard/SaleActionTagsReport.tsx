import { Tags } from 'lucide-react';
import { useSaleActionTags } from '@/hooks/useSaleActionTags';
import { ManageSaleActionTags } from '@/components/SaleActionTags';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export interface ActionTaggedSale {
  id: string; action_tag_id: string | null; total: number; customer_id: string | null;
  customer_name: string | null; status: string; sale_type: string | null;
}
const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export default function SaleActionTagsReport({ sales, loading, cards = false }: { sales: ActionTaggedSale[]; loading: boolean; cards?: boolean }) {
  const { data: tags = [], isLoading, isError } = useSaleActionTags();
  const rows = tags.map(tag => {
    const matching = sales.filter(sale => sale.action_tag_id === tag.id && sale.status === 'completed' && sale.sale_type !== 'brinde');
    const revenue = matching.reduce((sum, sale) => sum + Number(sale.total), 0);
    const customers = new Set(matching.map(sale => sale.customer_id || sale.customer_name).filter(Boolean)).size;
    return { ...tag, count: matching.length, revenue, customers, ticket: matching.length ? revenue / matching.length : 0 };
  }).sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name));
  const total = rows.reduce((sum, row) => sum + row.revenue, 0);
  if (cards) return <section aria-label="Resultados por ação" className="space-y-6">
    {loading || isLoading ? <Skeleton className="h-28 w-full" /> : isError ? <p role="alert" className="text-destructive">Não foi possível carregar as ações.</p> : <>
      <div className="border-b pb-5"><p className="text-sm text-muted-foreground">Total vendido nas ações</p><p className="text-3xl font-bold text-primary">{money(total)}</p></div>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma etiqueta cadastrada.</p> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map(row => <Card key={row.id} aria-label={`Resultados de ${row.name}`}>
          <CardHeader><CardTitle className="flex items-start gap-2 text-lg"><Tags className="mt-1 h-4 w-4 shrink-0 text-primary" /><span className="min-w-0 break-words">{row.name}</span></CardTitle>{!row.is_active && <p className="text-xs text-muted-foreground">Inativa</p>}</CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">Valor vendido</p><p className="mb-5 text-2xl font-bold">{money(row.revenue)}</p><dl className="grid grid-cols-2 gap-4 text-sm"><div><dt className="text-muted-foreground">Vendas</dt><dd className="text-lg font-semibold">{row.count}</dd></div><div><dt className="text-muted-foreground">Clientes</dt><dd className="text-lg font-semibold">{row.customers}</dd></div><div className="col-span-2 border-t pt-3"><dt className="text-muted-foreground">Ticket médio</dt><dd className="font-semibold">{money(row.ticket)}</dd></div></dl></CardContent>
        </Card>)}
      </div>}
    </>}
  </section>;
  return <Card>
    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
      <CardTitle className="flex items-center gap-2"><Tags className="h-5 w-5 text-primary" />Retorno por ação</CardTitle>
      <ManageSaleActionTags />
    </CardHeader>
    <CardContent>
      {loading || isLoading ? <Skeleton className="h-28 w-full" /> : isError ? <p role="alert" className="text-destructive">Não foi possível carregar as ações.</p> : <>
        <div className="mb-4"><span className="text-sm text-muted-foreground">Vendas com etiqueta</span><p className="text-2xl font-bold">{money(total)}</p></div>
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma etiqueta cadastrada.</p> : <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-muted-foreground"><th className="py-3 text-left">Ação</th><th className="px-3 text-right">Vendas</th><th className="px-3 text-right">Clientes</th><th className="px-3 text-right whitespace-nowrap">Valor vendido</th><th className="py-3 pl-3 text-right whitespace-nowrap">Ticket médio</th></tr></thead>
            <tbody>{rows.map(row => <tr key={row.id} className="border-b last:border-0"><th scope="row" className="py-3 text-left font-medium">{row.name}{!row.is_active && <span className="ml-2 text-xs text-muted-foreground">Inativa</span>}</th><td className="px-3 text-right">{row.count}</td><td className="px-3 text-right">{row.customers}</td><td className="px-3 text-right whitespace-nowrap font-semibold">{money(row.revenue)}</td><td className="py-3 pl-3 text-right whitespace-nowrap">{money(row.ticket)}</td></tr>)}</tbody>
          </table>
        </div>}
      </>}
    </CardContent>
  </Card>;
}