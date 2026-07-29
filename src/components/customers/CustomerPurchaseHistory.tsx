import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ShoppingCart, Monitor, Package, Loader2, Calendar, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CustomerPurchaseHistoryProps {
  customerId: string;
  customerName: string;
}

interface OrderItem {
  name?: string;
  product_name?: string;
  variation_name?: string;
  variation?: string;
  sku?: string;
  quantity?: number;
  qty?: number;
  unit_price?: number;
  price?: number;
  total?: number;
}

const formatCurrency = (value: number) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDate = (date: string) =>
  format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

const getItems = (raw: unknown): OrderItem[] =>
  Array.isArray(raw) ? (raw as unknown as OrderItem[]) : [];

const itemQty = (i: OrderItem) => Number(i.quantity ?? i.qty ?? 1);
const itemUnit = (i: OrderItem) => {
  const unit = Number(i.unit_price ?? i.price ?? 0);
  if (unit > 0) return unit;
  const total = Number(i.total ?? 0);
  const qty = itemQty(i) || 1;
  return total > 0 ? total / qty : 0;
};
const itemTotal = (i: OrderItem) => {
  const total = Number(i.total ?? 0);
  return total > 0 ? total : itemUnit(i) * itemQty(i);
};

interface SaleCardProps {
  type: 'online' | 'pdv';
  sale: any;
}

const SaleCard = ({ type, sale }: SaleCardProps) => {
  const [open, setOpen] = useState(false);
  const items = getItems(sale.items);
  const itemsTotal = items.reduce((acc, i) => acc + itemTotal(i), 0);
  const discount = Number(sale.discount_amount || 0);

  return (
    <Card>
      <CardContent className="py-4">
        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={type === 'online' ? 'default' : 'secondary'}>
                  {type === 'online' ? 'Online' : 'PDV'}
                </Badge>
                {sale.status && <Badge variant="outline">{sale.status}</Badge>}
                {sale.payment_method && <Badge variant="outline">{sale.payment_method}</Badge>}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {formatDate(sale.created_at)}
              </div>
              <div className="text-sm text-muted-foreground">
                {items.length} {items.length === 1 ? 'item' : 'itens'}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-lg font-bold">{formatCurrency(Number(sale.total))}</div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="mt-1">
                  {open ? 'Ocultar' : 'Detalhes'}
                  <ChevronDown
                    className={`h-4 w-4 ml-1 transition-transform ${open ? 'rotate-180' : ''}`}
                  />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          <CollapsibleContent className="mt-3">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Valor unit.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((i, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <div className="font-medium">{i.name || i.product_name || 'Produto'}</div>
                        {(i.variation_name || i.variation || i.sku) && (
                          <div className="text-xs text-muted-foreground">
                            {i.variation_name || i.variation || i.sku}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{itemQty(i)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(itemUnit(i))}</TableCell>
                      <TableCell className="text-right">{formatCurrency(itemTotal(i))}</TableCell>
                    </TableRow>
                  ))}
                  {!items.length && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                        Sem itens registrados
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Soma dos itens</span>
                <span>{formatCurrency(itemsTotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Desconto</span>
                  <span>- {formatCurrency(discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold">
                <span>Total pago</span>
                <span>{formatCurrency(Number(sale.total))}</span>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};

const CustomerPurchaseHistory = ({ customerId }: CustomerPurchaseHistoryProps) => {
  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['customer-orders', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: posSales = [], isLoading: loadingPOS } = useQuery({
    queryKey: ['customer-pos-sales', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pos_sales')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const totalOrders = orders.reduce((acc, order) => acc + Number(order.total), 0);
  const totalPOS = posSales.reduce((acc, sale) => acc + Number(sale.total), 0);
  const totalGeral = totalOrders + totalPOS;

  if (loadingOrders || loadingPOS) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasHistory = orders.length > 0 || posSales.length > 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Pedidos Online</span>
            </div>
            <div className="mt-1">
              <span className="text-2xl font-bold">{orders.length}</span>
              <span className="text-sm text-muted-foreground ml-2">{formatCurrency(totalOrders)}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Vendas PDV</span>
            </div>
            <div className="mt-1">
              <span className="text-2xl font-bold">{posSales.length}</span>
              <span className="text-sm text-muted-foreground ml-2">{formatCurrency(totalPOS)}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Geral</span>
            </div>
            <div className="mt-1">
              <span className="text-2xl font-bold">{orders.length + posSales.length}</span>
              <span className="text-sm text-muted-foreground ml-2">{formatCurrency(totalGeral)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {!hasHistory ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Nenhuma compra registrada</h3>
            <p className="text-muted-foreground mt-1">
              Este cliente ainda não possui histórico de compras vinculado.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">Todos ({orders.length + posSales.length})</TabsTrigger>
            <TabsTrigger value="online">Online ({orders.length})</TabsTrigger>
            <TabsTrigger value="pdv">PDV ({posSales.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-3 mt-4">
            {[
              ...orders.map((o) => ({ sale: o, type: 'online' as const })),
              ...posSales.map((s) => ({ sale: s, type: 'pdv' as const })),
            ]
              .sort(
                (a, b) =>
                  new Date(b.sale.created_at).getTime() - new Date(a.sale.created_at).getTime()
              )
              .map(({ sale, type }) => (
                <SaleCard key={`${type}-${sale.id}`} sale={sale} type={type} />
              ))}
          </TabsContent>

          <TabsContent value="online" className="space-y-3 mt-4">
            {orders.map((order) => (
              <SaleCard key={order.id} sale={order} type="online" />
            ))}
          </TabsContent>

          <TabsContent value="pdv" className="space-y-3 mt-4">
            {posSales.map((sale) => (
              <SaleCard key={sale.id} sale={sale} type="pdv" />
            ))}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default CustomerPurchaseHistory;
