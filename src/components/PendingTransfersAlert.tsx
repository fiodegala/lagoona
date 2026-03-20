import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Check, X, ArrowRight, Package } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Store {
  id: string;
  name: string;
  type: string;
}

interface PendingTransfer {
  id: string;
  from_store_id: string;
  to_store_id: string;
  product_id: string;
  variation_id: string | null;
  quantity: number;
  notes: string | null;
  requested_by: string;
  created_at: string;
  product_name: string;
  variation_label: string;
  from_store_name: string;
  to_store_name: string;
  requester_name: string;
}

interface Props {
  stores: Store[];
  onTransferProcessed: () => void;
}

const PendingTransfersAlert: React.FC<Props> = ({ stores, onTransferProcessed }) => {
  const { user, userStoreId, accessibleStoreIds } = useAuth();
  const { toast } = useToast();
  const [pendingTransfers, setPendingTransfers] = useState<PendingTransfer[]>([]);
  const [confirmTransfer, setConfirmTransfer] = useState<PendingTransfer | null>(null);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject'>('approve');
  const [isProcessing, setIsProcessing] = useState(false);

  const storeMap: Record<string, string> = {};
  stores.forEach(s => { storeMap[s.id] = s.name; });

  const loadPendingTransfers = async () => {
    // Only show pending transfers where the origin store (from_store_id) is the current user's store
    // This ensures only users from the origin store can approve/reject
    if (!userStoreId) {
      setPendingTransfers([]);
      return;
    }

    // Get all store IDs this user has access to (for online store users, includes website store)
    const accessibleIds = accessibleStoreIds.length > 0 ? accessibleStoreIds : [userStoreId];

    const { data } = await supabase
      .from('stock_transfers')
      .select('*')
      .eq('status', 'pending')
      .in('from_store_id', accessibleIds)
      .order('created_at', { ascending: false });

    if (!data || data.length === 0) {
      setPendingTransfers([]);
      return;
    }

    // Fetch store names directly to avoid stale closure
    const { data: storesData } = await supabase.from('stores').select('id, name');
    const freshStoreMap: Record<string, string> = {};
    (storesData || []).forEach(s => { freshStoreMap[s.id] = s.name; });

    // Enrich with product names
    const productIds = [...new Set(data.map(t => t.product_id))];
    const { data: prods } = await supabase
      .from('products')
      .select('id, name')
      .in('id', productIds);
    const prodMap: Record<string, string> = {};
    (prods || []).forEach(p => { prodMap[p.id] = p.name; });

    // Get variation labels
    const variationIds = data.filter(t => t.variation_id).map(t => t.variation_id!);
    let varLabelMap: Record<string, string> = {};
    if (variationIds.length > 0) {
      const { data: varData } = await supabase
        .from('product_variation_values')
        .select('variation_id, product_attribute_values(value)')
        .in('variation_id', variationIds);
      const grouped: Record<string, string[]> = {};
      (varData || []).forEach((v: any) => {
        if (!grouped[v.variation_id]) grouped[v.variation_id] = [];
        grouped[v.variation_id].push(v.product_attribute_values?.value || '');
      });
      Object.entries(grouped).forEach(([vid, vals]) => {
        varLabelMap[vid] = vals.join(' / ');
      });
    }

    // Get requester names
    const requesterIds = [...new Set(data.map(t => t.requested_by))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', requesterIds);
    const profileMap: Record<string, string> = {};
    (profiles || []).forEach(p => { profileMap[p.user_id] = p.full_name; });

    setPendingTransfers(data.map(t => ({
      ...t,
      product_name: prodMap[t.product_id] || 'Produto removido',
      from_store_name: freshStoreMap[t.from_store_id] || '?',
      to_store_name: freshStoreMap[t.to_store_id] || '?',
      variation_label: t.variation_id ? varLabelMap[t.variation_id] || '' : '',
      requester_name: profileMap[t.requested_by] || 'Usuário',
    })));
  };

  useEffect(() => {
    loadPendingTransfers();

    const channel = supabase
      .channel('pending-transfers')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stock_transfers' },
        () => loadPendingTransfers()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userStoreId, accessibleStoreIds]);


  const handleApprove = async (transfer: PendingTransfer) => {
    setIsProcessing(true);
    try {
      // Execute stock transfer
      const sourceQuery = supabase
        .from('store_stock')
        .select('id, quantity')
        .eq('store_id', transfer.from_store_id)
        .eq('product_id', transfer.product_id);
      if (transfer.variation_id) sourceQuery.eq('variation_id', transfer.variation_id);
      else sourceQuery.is('variation_id', null);

      const { data: source } = await sourceQuery.maybeSingle();
      
      if (!source || source.quantity < transfer.quantity) {
        toast({ title: 'Estoque insuficiente na origem', variant: 'destructive' });
        setIsProcessing(false);
        setConfirmTransfer(null);
        return;
      }

      await supabase
        .from('store_stock')
        .update({ quantity: Math.max(0, source.quantity - transfer.quantity), updated_at: new Date().toISOString() } as any)
        .eq('id', source.id);

      // Increase at destination
      const destQuery = supabase
        .from('store_stock')
        .select('id, quantity')
        .eq('store_id', transfer.to_store_id)
        .eq('product_id', transfer.product_id);
      if (transfer.variation_id) destQuery.eq('variation_id', transfer.variation_id);
      else destQuery.is('variation_id', null);

      const { data: dest } = await destQuery.maybeSingle();
      if (dest) {
        await supabase
          .from('store_stock')
          .update({ quantity: dest.quantity + transfer.quantity, updated_at: new Date().toISOString() } as any)
          .eq('id', dest.id);
      } else {
        await supabase
          .from('store_stock')
          .insert({
            store_id: transfer.to_store_id,
            product_id: transfer.product_id,
            variation_id: transfer.variation_id,
            quantity: transfer.quantity,
          } as any);
      }

      await supabase
        .from('stock_transfers')
        .update({ status: 'completed', approved_by: user!.id } as any)
        .eq('id', transfer.id);

      toast({ title: 'Transferência aprovada!', description: 'O estoque foi atualizado com sucesso.' });
      setConfirmTransfer(null);
      loadPendingTransfers();
      onTransferProcessed();
    } catch (error: any) {
      toast({ title: 'Erro ao aprovar', description: error.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (transfer: PendingTransfer) => {
    setIsProcessing(true);
    try {
      await supabase
        .from('stock_transfers')
        .update({ status: 'rejected', approved_by: user!.id } as any)
        .eq('id', transfer.id);

      toast({ title: 'Transferência rejeitada' });
      setConfirmTransfer(null);
      loadPendingTransfers();
    } catch (error: any) {
      toast({ title: 'Erro ao rejeitar', description: error.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  if (pendingTransfers.length === 0) return null;

  return (
    <>
      <Card className="border-orange-300 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-5 w-5 text-orange-600 animate-pulse" />
            <span>Transferências Pendentes</span>
            <Badge variant="destructive" className="ml-2">{pendingTransfers.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingTransfers.map(t => (
            <div key={t.id} className="flex items-center justify-between gap-4 p-3 bg-background rounded-lg border">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{t.product_name}</span>
                  {t.variation_label && (
                    <Badge variant="outline" className="text-xs shrink-0">{t.variation_label}</Badge>
                  )}
                  <Badge className="shrink-0">{t.quantity} un.</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <span className="font-medium">{t.from_store_name}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="font-medium">{t.to_store_name}</span>
                  <span className="ml-2">• Solicitado por {t.requester_name}</span>
                  <span>• {new Date(t.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
                {t.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{t.notes}"</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => { setConfirmTransfer(t); setConfirmAction('approve'); }}
                >
                  <Check className="h-3 w-3 mr-1" /> Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => { setConfirmTransfer(t); setConfirmAction('reject'); }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Confirmation dialog */}
      <Dialog open={!!confirmTransfer} onOpenChange={(v) => { if (!v) setConfirmTransfer(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction === 'approve' ? 'Confirmar Aprovação' : 'Confirmar Rejeição'}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === 'approve'
                ? 'Ao aprovar, o estoque será transferido automaticamente entre as lojas.'
                : 'Ao rejeitar, a solicitação será cancelada e nenhuma movimentação será feita.'}
            </DialogDescription>
          </DialogHeader>
          {confirmTransfer && (
            <div className="space-y-2 py-2">
              <p className="text-sm"><strong>Produto:</strong> {confirmTransfer.product_name} {confirmTransfer.variation_label && `(${confirmTransfer.variation_label})`}</p>
              <p className="text-sm"><strong>Quantidade:</strong> {confirmTransfer.quantity} un.</p>
              <p className="text-sm">
                <strong>De:</strong> {confirmTransfer.from_store_name} <ArrowRight className="inline h-3 w-3 mx-1" /> <strong>Para:</strong> {confirmTransfer.to_store_name}
              </p>
              {confirmTransfer.notes && <p className="text-sm"><strong>Obs:</strong> {confirmTransfer.notes}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmTransfer(null)} disabled={isProcessing}>Cancelar</Button>
            {confirmAction === 'approve' ? (
              <Button onClick={() => confirmTransfer && handleApprove(confirmTransfer)} disabled={isProcessing}>
                {isProcessing ? 'Processando...' : 'Confirmar Aprovação'}
              </Button>
            ) : (
              <Button variant="destructive" onClick={() => confirmTransfer && handleReject(confirmTransfer)} disabled={isProcessing}>
                {isProcessing ? 'Processando...' : 'Confirmar Rejeição'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PendingTransfersAlert;
