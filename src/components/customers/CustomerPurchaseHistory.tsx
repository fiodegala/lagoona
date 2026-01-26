import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShoppingCart, Monitor, Package, Loader2, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CustomerPurchaseHistoryProps {
  customerId: string;
  customerName: string;
}

interface OrderItem {
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

const CustomerPurchaseHistory = ({ customerId, customerName }: CustomerPurchaseHistoryProps) => {
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

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatDate = (date: string) =>
    format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  const totalOrders = orders.reduce((acc, order) => acc + Number(order.total), 0);
  const totalPOS = posSales.reduce((acc, sale) => acc + Number(sale.total), 0);
  const totalGeral = totalOrders + totalPOS;

  const isLoading = loadingOrders || loadingPOS;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasHistory = orders.length > 0 || posSales.length > 0;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Pedidos Online</span>
            </div>
            <div className="mt-1">
              <span className="text-2xl font-bold">{orders.length}</span>
              <span className="text-sm text-muted-foreground ml-2">
                {formatCurrency(totalOrders)}
              </span>
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
              <span className="text-sm text-muted-foreground ml-2">
                {formatCurrency(totalPOS)}
              </span>
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
              <span className="text-sm text-muted-foreground ml-2">
                {formatCurrency(totalGeral)}
              </span>
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
            {[...orders.map(o => ({ ...o, type: 'online' as const })), 
              ...posSales.map(s => ({ ...s, type: 'pdv' as const }))]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((item) => (
                <Card key={item.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={item.type === 'online' ? 'default' : 'secondary'}>
                            {item.type === 'online' ? 'Online' : 'PDV'}
                          </Badge>
                          {'status' in item && (
                            <Badge variant="outline">{item.status}</Badge>
                          )}
                          {'payment_method' in item && (
                            <Badge variant="outline">{item.payment_method}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(item.created_at)}
                        </div>
                      <div className="text-sm">
                        {Array.isArray(item.items) && (item.items as unknown as OrderItem[]).map((i, idx) => (
                          <span key={idx}>
                            {i.quantity}x {i.name}
                            {idx < (item.items as unknown as OrderItem[]).length - 1 ? ', ' : ''}
                          </span>
                        ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold">
                          {formatCurrency(Number(item.total))}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </TabsContent>

          <TabsContent value="online" className="space-y-3 mt-4">
            {orders.map((order) => (
              <Card key={order.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge>Online</Badge>
                        <Badge variant="outline">{order.status}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDate(order.created_at)}
                      </div>
                      <div className="text-sm">
                        {Array.isArray(order.items) && (order.items as unknown as OrderItem[]).map((i, idx) => (
                          <span key={idx}>
                            {i.quantity}x {i.name}
                            {idx < (order.items as unknown as OrderItem[]).length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold">
                        {formatCurrency(Number(order.total))}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="pdv" className="space-y-3 mt-4">
            {posSales.map((sale) => (
              <Card key={sale.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">PDV</Badge>
                        <Badge variant="outline">{sale.payment_method}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDate(sale.created_at)}
                      </div>
                      <div className="text-sm">
                        {Array.isArray(sale.items) && (sale.items as unknown as OrderItem[]).map((i, idx) => (
                          <span key={idx}>
                            {i.quantity}x {i.name}
                            {idx < (sale.items as unknown as OrderItem[]).length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold">
                        {formatCurrency(Number(sale.total))}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default CustomerPurchaseHistory;
