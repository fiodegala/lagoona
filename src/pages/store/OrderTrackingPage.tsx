import { useState } from 'react';
import { Package, Search, Truck, CheckCircle, Clock, XCircle, MapPin, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import StoreLayout from '@/components/store/StoreLayout';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusConfig: Record<string, { label: string; icon: any; color: string; step: number }> = {
  pending: { label: 'Pendente', icon: Clock, color: 'text-yellow-500', step: 0 },
  confirmed: { label: 'Confirmado', icon: CheckCircle, color: 'text-green-500', step: 1 },
  processing: { label: 'Em preparo', icon: Package, color: 'text-sky-400', step: 2 },
  shipped: { label: 'Enviado', icon: Truck, color: 'text-blue-500', step: 3 },
  delivered: { label: 'Entregue', icon: CheckCircle, color: 'text-purple-500', step: 4 },
  cancelled: { label: 'Cancelado', icon: XCircle, color: 'text-red-500', step: -1 },
};

const steps = [
  { key: 'pending', label: 'Pedido recebido' },
  { key: 'confirmed', label: 'Confirmado' },
  { key: 'processing', label: 'Em preparo' },
  { key: 'shipped', label: 'Enviado' },
  { key: 'delivered', label: 'Entregue' },
];

const OrderTrackingPage = () => {
  const [email, setEmail] = useState('');
  const [orderId, setOrderId] = useState('');
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !orderId.trim()) {
      toast.error('Preencha o e-mail e o número do pedido');
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const { data, error } = await supabase.functions.invoke('track-order', {
        body: { email: email.trim().toLowerCase(), orderId: orderId.trim() },
      });

      if (error) throw error;
      if (data?.order) {
        setOrder(data.order);
      } else {
        setOrder(null);
      }
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const currentStep = order ? (statusConfig[order.status]?.step ?? 0) : 0;
  const isCancelled = order?.status === 'cancelled';

  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <MapPin className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Rastrear Pedido</h1>
          <p className="text-muted-foreground mt-1">Acompanhe o status do seu pedido</p>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <Label htmlFor="email">E-mail usado na compra</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  maxLength={255}
                />
              </div>
              <div>
                <Label htmlFor="orderId">Número do pedido</Label>
                <Input
                  id="orderId"
                  placeholder="Ex: 29e18373-53fd-470e..."
                  value={orderId}
                  onChange={e => setOrderId(e.target.value)}
                  required
                  maxLength={50}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  'Buscando...'
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Buscar Pedido
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {searched && !loading && !order && (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium text-foreground">Pedido não encontrado</p>
              <p className="text-sm text-muted-foreground mt-1">Verifique o e-mail e o número do pedido e tente novamente.</p>
            </CardContent>
          </Card>
        )}

        {order && (
          <div className="space-y-6 animate-fade-in">
            {/* Status Timeline */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Status do Pedido</CardTitle>
                  {isCancelled ? (
                    <Badge variant="destructive">Cancelado</Badge>
                  ) : (
                    <Badge variant="default">{statusConfig[order.status]?.label || order.status}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!isCancelled && (
                  <div className="flex items-center justify-between mb-6">
                    {steps.map((step, i) => {
                      const isCompleted = i <= currentStep;
                      const isCurrent = i === currentStep;
                      return (
                        <div key={step.key} className="flex flex-col items-center flex-1 relative">
                          {i > 0 && (
                            <div className={`absolute top-3 right-1/2 w-full h-0.5 -z-10 ${i <= currentStep ? 'bg-primary' : 'bg-muted'}`} />
                          )}
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isCompleted ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'} ${isCurrent ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}>
                            {isCompleted ? '✓' : i + 1}
                          </div>
                          <span className={`text-[10px] mt-1 text-center leading-tight ${isCompleted ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tracking Info */}
            {order.tracking_code && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    Rastreamento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Transportadora</span>
                    <span className="font-medium capitalize">{order.shipping_carrier || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Código de rastreio</span>
                    <span className="font-mono text-sm font-medium">{order.tracking_code}</span>
                  </div>
                  {order.shipped_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Enviado em</span>
                      <span className="text-sm">{format(new Date(order.shipped_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                    </div>
                  )}
                  {order.tracking_url && (
                    <a href={order.tracking_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" className="w-full mt-2">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Rastrear no site da transportadora
                      </Button>
                    </a>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Order Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Detalhes do Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Nº do Pedido</span>
                  <span className="font-mono text-xs">{order.id}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Data</span>
                  <span>{format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                </div>
                <Separator />
                {order.items && Array.isArray(order.items) && order.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span>{item.name} × {item.quantity}</span>
                    <span className="font-medium">R$ {(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <Separator />
                <div className="flex items-center justify-between font-bold">
                  <span>Total</span>
                  <span>R$ {Number(order.total).toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </StoreLayout>
  );
};

export default OrderTrackingPage;
