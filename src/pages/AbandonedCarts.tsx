import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  ShoppingCart,
  Search,
  Eye,
  Package,
  Clock,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface AbandonedCart {
  id: string;
  session_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  shipping_address: any;
  items: any[];
  subtotal: number;
  item_count: number;
  status: string;
  recovered_at: string | null;
  notified_at: string | null;
  created_at: string;
  updated_at: string;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

const AbandonedCarts = () => {
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCart, setSelectedCart] = useState<AbandonedCart | null>(null);

  const fetchCarts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('abandoned_carts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setCarts((data as unknown as AbandonedCart[]) || []);
    } catch (err) {
      console.error('Error fetching abandoned carts:', err);
      toast.error('Erro ao carregar carrinhos abandonados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCarts();
  }, []);

  const filteredCarts = carts.filter((cart) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      cart.customer_name?.toLowerCase().includes(s) ||
      cart.customer_email?.toLowerCase().includes(s) ||
      cart.customer_phone?.toLowerCase().includes(s) ||
      cart.items?.some((item: any) => item.name?.toLowerCase().includes(s))
    );
  });

  const abandonedCount = carts.filter((c) => c.status === 'abandoned').length;
  const recoveredCount = carts.filter((c) => c.status === 'recovered').length;
  const totalLost = carts
    .filter((c) => c.status === 'abandoned')
    .reduce((acc, c) => acc + c.subtotal, 0);

  const markAsRecovered = async (id: string) => {
    try {
      const { error } = await supabase
        .from('abandoned_carts')
        .update({ status: 'recovered', recovered_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast.success('Carrinho marcado como recuperado');
      fetchCarts();
      setSelectedCart(null);
    } catch {
      toast.error('Erro ao atualizar status');
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Carrinhos Abandonados</h1>
          <p className="text-muted-foreground">
            Monitore os carrinhos abandonados e recupere vendas perdidas.
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Abandonados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{abandonedCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Recuperados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{recoveredCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-red-500" />
                Valor Perdido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatPrice(totalLost)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Search & Refresh */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" size="icon" onClick={fetchCarts}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produtos</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredCarts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      Nenhum carrinho abandonado encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCarts.map((cart) => (
                    <TableRow key={cart.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">
                            {cart.customer_name || 'Visitante anônimo'}
                          </p>
                          {cart.customer_email && (
                            <p className="text-xs text-muted-foreground">{cart.customer_email}</p>
                          )}
                          {cart.customer_phone && (
                            <p className="text-xs text-muted-foreground">{cart.customer_phone}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{cart.item_count} {cart.item_count === 1 ? 'item' : 'itens'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-sm">{formatPrice(cart.subtotal)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">
                            {format(new Date(cart.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={cart.status === 'recovered' ? 'default' : 'secondary'} className={cart.status === 'recovered' ? 'bg-green-600' : 'bg-amber-500 text-white'}>
                            {cart.status === 'recovered' ? 'Recuperado' : 'Abandonado'}
                          </Badge>
                          {cart.notified_at && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MessageCircle className="h-3 w-3" />
                              Notificado
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setSelectedCart(cart)}>
                          <Eye className="h-4 w-4 mr-1" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selectedCart} onOpenChange={() => setSelectedCart(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Detalhes do Carrinho
            </DialogTitle>
          </DialogHeader>

          {selectedCart && (
            <div className="space-y-4">
              {/* Customer Info */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Dados do Cliente</h4>
                <div className="bg-muted rounded-lg p-3 space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Nome:</span> {selectedCart.customer_name || 'Não informado'}</p>
                  <p><span className="text-muted-foreground">Email:</span> {selectedCart.customer_email || 'Não informado'}</p>
                  <p><span className="text-muted-foreground">Telefone:</span> {selectedCart.customer_phone || 'Não informado'}</p>
                  {selectedCart.shipping_address && (
                    <p>
                      <span className="text-muted-foreground">Endereço:</span>{' '}
                      {[
                        selectedCart.shipping_address.address,
                        selectedCart.shipping_address.city,
                        selectedCart.shipping_address.state,
                        selectedCart.shipping_address.zip_code,
                      ].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Timing */}
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Criado em:</span>{' '}
                  {format(new Date(selectedCart.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </div>
                <div>
                  <span className="text-muted-foreground">Última atividade:</span>{' '}
                  {format(new Date(selectedCart.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </div>
                {selectedCart.notified_at && (
                  <div className="flex items-center gap-1 text-green-600">
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span className="text-muted-foreground">Notificado via WhatsApp:</span>{' '}
                    {format(new Date(selectedCart.notified_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </div>
                )}
              </div>

              <Separator />

              {/* Items */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Produtos ({selectedCart.item_count})</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(selectedCart.items as any[]).map((item: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 bg-muted rounded-lg p-2">
                      <div className="w-10 h-10 rounded bg-background overflow-hidden shrink-0">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-4 w-4 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        {item.variationLabel && (
                          <p className="text-xs text-muted-foreground">{item.variationLabel}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium">{formatPrice(item.price * item.quantity)}</p>
                        <p className="text-xs text-muted-foreground">{item.quantity}x {formatPrice(item.price)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Total & Actions */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Valor total</p>
                  <p className="text-xl font-bold">{formatPrice(selectedCart.subtotal)}</p>
                </div>
                <div className="flex gap-2">
                  {selectedCart.customer_phone && (
                    <Button size="sm" variant="outline" asChild>
                      <a
                        href={`https://wa.me/55${selectedCart.customer_phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${selectedCart.customer_name || ''}! Notamos que você deixou alguns itens no carrinho. Posso ajudar a finalizar sua compra? 😊`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        WhatsApp
                      </a>
                    </Button>
                  )}
                  {selectedCart.status !== 'recovered' && (
                    <Button size="sm" onClick={() => markAsRecovered(selectedCart.id)}>
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Marcar Recuperado
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AbandonedCarts;
