import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { auditService } from '@/services/auditService';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ShoppingCart, Truck, ExternalLink, Package, Search, MessageCircle, Clock, CheckCircle2, XCircle, Printer, Eye, Trash2, Pencil, ArrowLeftRight } from 'lucide-react';
import ShippingLabelModal from '@/components/ShippingLabelModal';
import OrderDetailModal from '@/components/OrderDetailModal';
import OrderEditModal from '@/components/OrderEditModal';
import OrderExchangeModal from '@/components/OrderExchangeModal';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CARRIERS = [
  { value: 'correios', label: 'Correios', urlTemplate: 'https://www.linkcorreios.com.br/?id={code}' },
  { value: 'jadlog', label: 'Jadlog', urlTemplate: 'https://www.jadlog.com.br/tracking?cte={code}' },
  { value: 'azul_cargo', label: 'Azul Cargo', urlTemplate: 'https://www.azulcargoexpress.com.br/rastreamento?awb={code}' },
  { value: 'loggi', label: 'Loggi', urlTemplate: 'https://www.loggi.com/rastreio/{code}' },
  { value: 'outro', label: 'Outra transportadora', urlTemplate: '' },
];

const statusMap: Record<string, { label: string; variant: 'outline'; className: string }> = {
  pending: { label: 'Pendente', variant: 'outline', className: 'border-yellow-500 bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400' },
  confirmed: { label: 'Confirmado', variant: 'outline', className: 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400' },
  processing: { label: 'Em preparo', variant: 'outline', className: 'border-sky-400 bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-400' },
  shipped: { label: 'Enviado', variant: 'outline', className: 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400' },
  delivered: { label: 'Entregue', variant: 'outline', className: 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-400' },
  cancelled: { label: 'Cancelado', variant: 'outline', className: 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400' },
};

const paymentStatusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle2 }> = {
  approved: { label: 'Aprovado', variant: 'default', icon: CheckCircle2 },
  pending: { label: 'Pendente', variant: 'outline', icon: Clock },
  in_process: { label: 'Em análise', variant: 'secondary', icon: Clock },
  rejected: { label: 'Recusado', variant: 'destructive', icon: XCircle },
  refunded: { label: 'Devolvido', variant: 'destructive', icon: XCircle },
  cancelled: { label: 'Cancelado', variant: 'destructive', icon: XCircle },
  charged_back: { label: 'Contestado', variant: 'destructive', icon: XCircle },
};

const messageTypeLabels: Record<string, string> = {
  tracking: '📦 Rastreio',
  confirmed: '✅ Confirmado',
  processing: '📦 Em preparo',
  shipped: '🚚 Enviado',
  delivered: '🎉 Entregue',
  cancelled: '❌ Cancelado',
};

const Orders = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [trackingModal, setTrackingModal] = useState<{ open: boolean; orderId: string; order?: any }>({ open: false, orderId: '' });
  const [trackingCode, setTrackingCode] = useState('');
  const [carrier, setCarrier] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [sendWhatsapp, setSendWhatsapp] = useState(true);
  const [labelOrder, setLabelOrder] = useState<any>(null);
  const [detailOrder, setDetailOrder] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'single' | 'bulk'; id?: string } | null>(null);
  const [editOrder, setEditOrder] = useState<any>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: whatsappLogs = [] } = useQuery({
    queryKey: ['whatsapp-logs', trackingModal.orderId],
    queryFn: async () => {
      if (!trackingModal.orderId) return [];
      const { data, error } = await supabase
        .from('whatsapp_logs' as any)
        .select('*')
        .eq('order_id', trackingModal.orderId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!trackingModal.orderId && trackingModal.open,
  });

  const updateTrackingMutation = useMutation({
    mutationFn: async ({ orderId, tracking_code, shipping_carrier, tracking_url }: { orderId: string; tracking_code: string; shipping_carrier: string; tracking_url: string }) => {
      const { error } = await supabase
        .from('orders')
        .update({
          tracking_code,
          shipping_carrier,
          tracking_url,
          shipped_at: new Date().toISOString(),
          status: 'shipped',
        })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Código de rastreamento adicionado!');
      setTrackingModal({ open: false, orderId: '' });
    },
    onError: () => toast.error('Erro ao salvar rastreamento'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-order-status`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ order_id: orderId, status }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao atualizar status');
      return { orderId, status };
    },
    onSuccess: async (_, { orderId, status }) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Status atualizado!');

      if (['confirmed', 'processing', 'delivered', 'cancelled'].includes(status)) {
        const order = orders.find(o => o.id === orderId);
        if (!order) return;

        let phone = '';
        if (order.customer_id) {
          const { data: customer } = await supabase.from('customers').select('phone').eq('id', order.customer_id).single();
          phone = customer?.phone || '';
        }

        if (!phone) return;

        try {
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session?.access_token}`,
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              },
              body: JSON.stringify({
                phone,
                customerName: order.customer_name,
                messageType: status,
                orderId,
              }),
            }
          );
          if (res.ok) {
            toast.success('Notificação WhatsApp enviada!');
            queryClient.invalidateQueries({ queryKey: ['whatsapp-logs', orderId] });
          } else {
            toast.error('Status salvo, mas falha ao enviar WhatsApp');
          }
        } catch {
          console.error('Erro ao enviar WhatsApp de status');
        }
      }
    },
  });

  const openTrackingModal = async (order: any) => {
    setTrackingCode(order.tracking_code || '');
    setCarrier(order.shipping_carrier || '');
    setCustomUrl(order.tracking_url || '');
    
    let phone = '';
    const orderMeta = order.metadata || {};
    const orderAddr = order.shipping_address || {};
    // Prioridade: telefone do pedido (metadata/endereço) > cadastro do cliente
    phone = orderMeta.customer_phone || orderAddr.phone || '';
    if (!phone && order.customer_id) {
      const { data: customer } = await supabase.from('customers').select('phone').eq('id', order.customer_id).single();
      phone = customer?.phone || '';
    }
    setWhatsappPhone(phone);
    setSendWhatsapp(!!phone);
    setTrackingModal({ open: true, orderId: order.id, order });
  };

  const handleSaveTracking = async () => {
    if (!trackingCode || !carrier) {
      toast.error('Preencha o código de rastreio e a transportadora');
      return;
    }
    const selectedCarrier = CARRIERS.find(c => c.value === carrier);
    const url = carrier === 'outro' ? customUrl : (selectedCarrier?.urlTemplate.replace('{code}', trackingCode) || '');
    
    updateTrackingMutation.mutate(
      { orderId: trackingModal.orderId, tracking_code: trackingCode, shipping_carrier: carrier, tracking_url: url },
      {
        onSuccess: async () => {
          if (sendWhatsapp && whatsappPhone) {
            try {
              const { data: { session } } = await supabase.auth.getSession();
              const res = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session?.access_token}`,
                    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                  },
                  body: JSON.stringify({
                    phone: whatsappPhone,
                    customerName: trackingModal.order?.customer_name,
                    trackingCode,
                    trackingUrl: url,
                    carrier: selectedCarrier?.label || carrier,
                    orderId: trackingModal.orderId,
                  }),
                }
              );
              if (res.ok) {
                toast.success('WhatsApp enviado com sucesso!');
                queryClient.invalidateQueries({ queryKey: ['whatsapp-logs', trackingModal.orderId] });
              } else {
                toast.error('Rastreio salvo, mas falha ao enviar WhatsApp');
              }
            } catch {
              toast.error('Rastreio salvo, mas erro ao enviar WhatsApp');
            }
          }
        },
      }
    );
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch = (o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
     o.customer_email?.toLowerCase().includes(search.toLowerCase()) ||
     o.tracking_code?.toLowerCase().includes(search.toLowerCase()) ||
     o.id.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDeleteOrders = async () => {
    if (!deleteConfirm) return;
    try {
      const idsToDelete = deleteConfirm.type === 'single' ? [deleteConfirm.id!] : selectedIds;

      // Log audit before deletion (capture order details)
      const deletedOrders = orders.filter(o => idsToDelete.includes(o.id));
      for (const order of deletedOrders) {
        await auditService.log({
          action: 'delete',
          entity_type: 'order',
          entity_id: order.id,
          details: {
            customer_name: order.customer_name,
            customer_email: order.customer_email,
            total: order.total,
            status: order.status,
            payment_status: order.payment_status,
          },
        });
      }

      const { error } = await supabase
        .from('orders')
        .delete()
        .in('id', idsToDelete);
      if (error) throw error;
      toast.success(`${idsToDelete.length} pedido(s) excluído(s)`);
      setDeleteConfirm(null);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    } catch {
      toast.error('Erro ao excluir pedido(s)');
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredOrders.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredOrders.map((o) => o.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pedidos</h1>
          <p className="text-muted-foreground mt-1">Visualize e gerencie os pedidos</p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, email ou rastreio..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filtrar status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(statusMap).map(([key, val]) => (
                <SelectItem key={key} value={key}>{val.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedIds.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteConfirm({ type: 'bulk' })}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Excluir ({selectedIds.length})
            </Button>
          )}
        </div>

        {isLoading ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">Carregando pedidos...</CardContent></Card>
        ) : filteredOrders.length === 0 ? (
          <Card className="card-elevated">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
              <CardTitle className="text-lg mb-2">Nenhum pedido encontrado</CardTitle>
              <CardDescription className="text-center">Os pedidos aparecerão aqui quando forem criados</CardDescription>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                     <TableHead className="w-10">
                       <Checkbox
                         checked={filteredOrders.length > 0 && selectedIds.length === filteredOrders.length}
                         onCheckedChange={toggleSelectAll}
                       />
                     </TableHead>
                     <TableHead>Pedido</TableHead>
                     <TableHead>Cliente</TableHead>
                     <TableHead>Total</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead>Pagamento</TableHead>
                     <TableHead>Rastreamento</TableHead>
                     <TableHead>Data</TableHead>
                     <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map(order => {
                    const status = statusMap[order.status] || { label: order.status, variant: 'outline' as const, className: '' };
                    return (
                      <TableRow key={order.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(order.id)}
                            onCheckedChange={() => toggleSelect(order.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{order.id.slice(0, 8)}...</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{order.customer_name || '—'}</p>
                            <p className="text-xs text-muted-foreground">{order.customer_email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">R$ {Number(order.total).toFixed(2)}</TableCell>
                        <TableCell>
                          <Select value={order.status} onValueChange={s => updateStatusMutation.mutate({ orderId: order.id, status: s })}>
                            <SelectTrigger className="w-[130px] h-8">
                              <Badge variant={status.variant} className={`text-xs ${status.className}`}>{status.label}</Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(statusMap).map(([key, val]) => (
                                <SelectItem key={key} value={key}>{val.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const ps = paymentStatusMap[order.payment_status || 'pending'] || { label: order.payment_status || '—', variant: 'outline' as const, icon: Clock };
                            const PayIcon = ps.icon;
                            return (
                              <Badge variant={ps.variant} className="gap-1 text-xs">
                                <PayIcon className="h-3 w-3" />
                                {ps.label}
                              </Badge>
                            );
                          })()}
                          {order.payment_method && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{order.payment_method}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          {order.tracking_code ? (
                            <div className="flex items-center gap-1">
                              <Package className="h-3 w-3 text-primary" />
                              <span className="text-xs font-mono">{order.tracking_code}</span>
                              {order.tracking_url && (
                                <a href={order.tracking_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(order.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="flex items-center gap-1">
                          <Button variant="outline" size="sm" onClick={() => setDetailOrder(order)}>
                            <Eye className="h-3 w-3 mr-1" />
                            Detalhes
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setEditOrder(order)}>
                            <Pencil className="h-3 w-3 mr-1" />
                            Editar
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openTrackingModal(order)}>
                            <Truck className="h-3 w-3 mr-1" />
                            Rastreio
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setLabelOrder(order)}>
                            <Printer className="h-3 w-3 mr-1" />
                            Etiqueta
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirm({ type: 'single', id: order.id })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={trackingModal.open} onOpenChange={o => setTrackingModal(prev => ({ ...prev, open: o }))}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Adicionar Rastreamento</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0 pr-2">
            <div className="space-y-4 py-2">
              <div>
                <Label>Transportadora</Label>
                <Select value={carrier} onValueChange={setCarrier}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {CARRIERS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Código de Rastreio</Label>
                <Input value={trackingCode} onChange={e => setTrackingCode(e.target.value)} placeholder="Ex: BR123456789BR" />
              </div>
              {carrier === 'outro' && (
                <div>
                  <Label>URL de Rastreamento</Label>
                  <Input value={customUrl} onChange={e => setCustomUrl(e.target.value)} placeholder="https://..." />
                </div>
              )}
              <div className="border-t pt-4 mt-2">
                <div className="flex items-center gap-2 mb-3">
                  <Checkbox
                    id="send-whatsapp"
                    checked={sendWhatsapp}
                    onCheckedChange={(checked) => setSendWhatsapp(!!checked)}
                  />
                  <label htmlFor="send-whatsapp" className="flex items-center gap-1.5 text-sm font-medium cursor-pointer">
                    <MessageCircle className="h-4 w-4 text-[#25D366]" />
                    Notificar cliente via WhatsApp
                  </label>
                </div>
                {sendWhatsapp && (
                  <div>
                    <Label>Telefone do cliente (com DDD)</Label>
                    <Input
                      value={whatsappPhone}
                      onChange={e => setWhatsappPhone(e.target.value)}
                      placeholder="11999999999"
                    />
                  </div>
                )}
              </div>

              {/* WhatsApp History */}
              {whatsappLogs.length > 0 && (
                <div className="border-t pt-4 mt-2">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Histórico de WhatsApp ({whatsappLogs.length})</span>
                  </div>
                  <div className="space-y-2">
                    {whatsappLogs.map((log: any) => (
                      <div key={log.id} className="flex items-start gap-2 rounded-md border p-2.5 text-xs">
                        {log.status === 'sent' ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">
                              {messageTypeLabels[log.message_type] || log.message_type}
                            </span>
                            <span className="text-muted-foreground whitespace-nowrap">
                              {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <p className="text-muted-foreground mt-0.5">
                            Para: {log.phone}
                            {log.customer_name && ` (${log.customer_name})`}
                          </p>
                          {log.error_message && (
                            <p className="text-destructive mt-0.5 truncate">{log.error_message}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrackingModal({ open: false, orderId: '' })}>Cancelar</Button>
            <Button onClick={handleSaveTracking} disabled={updateTrackingMutation.isPending}>
              {updateTrackingMutation.isPending ? 'Salvando...' : 'Salvar Rastreio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ShippingLabelModal
        open={!!labelOrder}
        onOpenChange={(open) => !open && setLabelOrder(null)}
        order={labelOrder}
      />

      <OrderDetailModal
        open={!!detailOrder}
        onOpenChange={(open) => !open && setDetailOrder(null)}
        order={detailOrder}
      />

      <OrderEditModal
        open={!!editOrder}
        onOpenChange={(open) => !open && setEditOrder(null)}
        order={editOrder}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['orders'] })}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.type === 'bulk'
                ? `Tem certeza que deseja excluir ${selectedIds.length} pedido(s)? Esta ação não pode ser desfeita.`
                : 'Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteOrders} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default Orders;
