import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Package, Mail, MapPin, CreditCard, Clock, Truck } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusMap: Record<string, { label: string; variant: 'outline'; className: string }> = {
  pending: { label: 'Pendente', variant: 'outline', className: 'border-yellow-500 bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400' },
  confirmed: { label: 'Confirmado', variant: 'outline', className: 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400' },
  processing: { label: 'Em preparo', variant: 'outline', className: 'border-sky-400 bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-400' },
  shipped: { label: 'Enviado', variant: 'outline', className: 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400' },
  delivered: { label: 'Entregue', variant: 'outline', className: 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-400' },
  cancelled: { label: 'Cancelado', variant: 'outline', className: 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400' },
};

const paymentStatusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  approved: { label: 'Aprovado', variant: 'default' },
  pending: { label: 'Pendente', variant: 'outline' },
  in_process: { label: 'Em análise', variant: 'secondary' },
  rejected: { label: 'Recusado', variant: 'destructive' },
  refunded: { label: 'Devolvido', variant: 'destructive' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
  charged_back: { label: 'Contestado', variant: 'destructive' },
};

interface OrderDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any | null;
}

const OrderDetailModal = ({ open, onOpenChange, order }: OrderDetailModalProps) => {
  if (!order) return null;

  const status = statusMap[order.status] || { label: order.status, variant: 'outline' as const, className: '' };
  const paymentStatus = paymentStatusMap[order.payment_status || 'pending'] || { label: order.payment_status || '—', variant: 'outline' as const };

  const items = (() => {
    try {
      const parsed = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const addr = order.shipping_address || {};

  const meta = order.metadata || {};
  const paymentTypeId = meta.payment_type_id || '';
  const installments = meta.installments || null;
  const installmentAmount = installments && installments > 0 ? (Number(order.total) / installments) : null;

  const brandMap: Record<string, string> = {
    master: 'Mastercard', visa: 'Visa', amex: 'American Express',
    elo: 'Elo', hipercard: 'Hipercard', cabal: 'Cabal',
  };

  const paymentMethodLabel = (() => {
    const method = order.payment_method || '';
    const type = paymentTypeId;

    // If payment_type_id is available, use it to determine type
    if (type === 'credit_card') {
      const brand = brandMap[method] || method.charAt(0).toUpperCase() + method.slice(1);
      return `Cartão de Crédito (${brand})`;
    }
    if (type === 'debit_card') {
      const brand = brandMap[method] || method.charAt(0).toUpperCase() + method.slice(1);
      return `Cartão de Débito (${brand})`;
    }
    if (type === 'bank_transfer' || method === 'pix') return 'PIX';
    if (type === 'ticket' || method === 'bolbradesco' || method === 'boleto') return 'Boleto Bancário';

    // Fallback: check if method is a known brand (older orders without payment_type_id)
    if (brandMap[method]) return `Cartão (${brandMap[method]})`;
    if (method === 'credit_card') return 'Cartão de Crédito';
    if (method === 'debit_card') return 'Cartão de Débito';
    if (method) return method.charAt(0).toUpperCase() + method.slice(1);
    return null;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Pedido #{order.id.slice(0, 8).toUpperCase()}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 pr-2 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
          <div className="space-y-5 py-2">
            {/* Status e Data */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={status.variant} className={status.className}>{status.label}</Badge>
                <Badge variant={paymentStatus.variant}>{paymentStatus.label}</Badge>
                {order.payment_method && (
                  <span className="text-xs text-muted-foreground capitalize">{order.payment_method}</span>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </div>
            </div>

            <Separator />

            {/* Cliente */}
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                Cliente
              </h4>
              <div className="text-sm space-y-0.5">
                <p className="font-medium">{order.customer_name || '—'}</p>
                <p className="text-muted-foreground">{order.customer_email}</p>
              </div>
            </div>

            {/* Endereço */}
            {(addr.address || addr.city) && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    Endereço de Entrega
                  </h4>
                  <div className="text-sm space-y-0.5 text-muted-foreground">
                    {addr.recipient_name && <p className="font-medium text-foreground">{addr.recipient_name}</p>}
                    {addr.address && <p>{addr.address}{addr.number ? `, ${addr.number}` : ''}</p>}
                    {addr.complement && <p>{addr.complement}</p>}
                    {addr.neighborhood && <p>{addr.neighborhood}</p>}
                    {(addr.city || addr.state) && <p>{[addr.city, addr.state].filter(Boolean).join(' - ')}</p>}
                    {addr.zip_code && <p className="font-mono">CEP: {addr.zip_code}</p>}
                  </div>
                </div>
              </>
            )}

            {/* Pagamento */}
            {paymentMethodLabel && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                    Forma de Pagamento
                  </h4>
                  <div className="text-sm space-y-0.5">
                    <p className="font-medium">{paymentMethodLabel}</p>
                    {installments && installments > 1 ? (
                      <p className="text-muted-foreground">
                        {installments}x de R$ {Number(installmentAmount).toFixed(2)} sem juros
                      </p>
                    ) : installments === 1 ? (
                      <p className="text-muted-foreground">À vista</p>
                    ) : null}
                  </div>
                </div>
              </>
            )}

            {/* Rastreamento */}
            {order.tracking_code && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                    Rastreamento
                  </h4>
                  <div className="text-sm space-y-0.5">
                    <p className="font-mono font-medium">{order.tracking_code}</p>
                    {order.shipping_carrier && <p className="text-muted-foreground capitalize">{order.shipping_carrier}</p>}
                    {order.shipped_at && (
                      <p className="text-xs text-muted-foreground">
                        Enviado em {format(new Date(order.shipped_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    )}
                    {order.tracking_url && (
                      <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                        Rastrear pedido →
                      </a>
                    )}
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Itens */}
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                Itens do Pedido
              </h4>
              {items.length > 0 ? (
                <div className="space-y-2">
                  {items.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between rounded-md border p-2.5 text-sm">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={item.image_url || item.imageUrl || '/placeholder.svg'}
                          alt={item.name || 'Produto'}
                          className="h-12 w-12 rounded-md object-cover shrink-0 border bg-muted"
                        />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{item.name || item.product_name || 'Produto'}</p>
                          {item.variation && <p className="text-xs text-muted-foreground">{item.variation}</p>}
                          {item.sku && <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="font-medium">R$ {Number(item.price || 0).toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">Qtd: {item.quantity || 1}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum item detalhado</p>
              )}
            </div>

            <Separator />

            {/* Total */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Total do Pedido</span>
              <span className="text-lg font-bold">R$ {Number(order.total).toFixed(2)}</span>
            </div>

            {/* Notas */}
            {order.notes && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold mb-1">Observações</h4>
                  <p className="text-sm text-muted-foreground">{order.notes}</p>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default OrderDetailModal;
