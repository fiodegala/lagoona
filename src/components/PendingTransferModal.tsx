import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Package, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface TransferData {
  id: string;
  from_store_id: string;
  to_store_id: string;
  product_id: string;
  variation_id: string | null;
  quantity: number;
  notes: string | null;
  requested_by: string;
  created_at: string;
  status: string;
}

interface EnrichedTransfer extends TransferData {
  product_name: string;
  variation_label: string;
  from_store_name: string;
  to_store_name: string;
  requester_name: string;
}

const PendingTransferModal: React.FC = () => {
  const { user, userStoreId, isAdmin, isManager, accessibleStoreIds } = useAuth();
  const { toast } = useToast();
  const [transfers, setTransfers] = useState<EnrichedTransfer[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const alertIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const playAlertSound = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const now = ctx.currentTime;

      // First beep — high pitch
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.frequency.value = 880;
      gain1.gain.setValueAtTime(0.4, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc1.start(now);
      osc1.stop(now + 0.15);

      // Second beep — higher pitch (urgency)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 1100;
      gain2.gain.setValueAtTime(0.4, now + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc2.start(now + 0.2);
      osc2.stop(now + 0.4);

      // Third beep — highest pitch
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.frequency.value = 1320;
      gain3.gain.setValueAtTime(0.45, now + 0.45);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc3.start(now + 0.45);
      osc3.stop(now + 0.7);
    } catch {}
  }, []);

  useEffect(() => {
    loadPendingForMyStore();

    const channel = supabase
      .channel('transfer-modal-alerts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stock_transfers' },
        () => loadPendingForMyStore()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userStoreId]);

  // Repeating sound alert every 15s while there are pending transfers
  useEffect(() => {
    if (transfers.length > 0) {
      playAlertSound(); // play immediately
      alertIntervalRef.current = setInterval(() => {
        playAlertSound();
      }, 15000);
    } else {
      if (alertIntervalRef.current) {
        clearInterval(alertIntervalRef.current);
        alertIntervalRef.current = null;
      }
    }
    return () => {
      if (alertIntervalRef.current) {
        clearInterval(alertIntervalRef.current);
        alertIntervalRef.current = null;
      }
    };
  }, [transfers.length, playAlertSound]);

  const loadPendingForMyStore = async () => {
    // Fetch stores fresh each time to avoid stale closures
    const { data: storesData } = await supabase.from('stores').select('id, name, type');
    const freshStoreMap: Record<string, string> = {};
    (storesData || []).forEach(s => { freshStoreMap[s.id] = s.name; });

    // Admins/managers see all pending transfers; physical store users see only theirs
    let query = supabase
      .from('stock_transfers')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (!isAdmin && !isManager && userStoreId) {
      query = query.eq('from_store_id', userStoreId);
    }

    const { data } = await query;

    if (!data || data.length === 0) {
      setTransfers([]);
      return;
    }

    // Enrich
    const productIds = [...new Set(data.map(t => t.product_id))];
    const { data: prods } = await supabase.from('products').select('id, name').in('id', productIds);
    const prodMap: Record<string, string> = {};
    (prods || []).forEach(p => { prodMap[p.id] = p.name; });

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

    const requesterIds = [...new Set(data.map(t => t.requested_by))];
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', requesterIds);
    const profileMap: Record<string, string> = {};
    (profiles || []).forEach(p => { profileMap[p.user_id] = p.full_name; });

    const enriched = data.map(t => ({
      ...t,
      product_name: prodMap[t.product_id] || 'Produto removido',
      from_store_name: freshStoreMap[t.from_store_id] || '?',
      to_store_name: freshStoreMap[t.to_store_id] || '?',
      variation_label: t.variation_id ? varLabelMap[t.variation_id] || '' : '',
      requester_name: profileMap[t.requested_by] || 'Usuário',
    }));

    setTransfers(enriched);
    setCurrentIndex(0);
  };

  const handleApprove = async () => {
    const transfer = transfers[currentIndex];
    if (!transfer) return;
    setIsProcessing(true);

    try {
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
        return;
      }

      await supabase
        .from('store_stock')
        .update({ quantity: Math.max(0, source.quantity - transfer.quantity), updated_at: new Date().toISOString() } as any)
        .eq('id', source.id);

      // Check if destination is an online/website store (aggregated stock)
      // If so, skip adding stock — online stock = sum of physical stores
      const { data: destStoreData } = await supabase.from('stores').select('type').eq('id', transfer.to_store_id).single();
      const isOnlineDestination = destStoreData?.type === 'online' || destStoreData?.type === 'website';

      if (!isOnlineDestination) {
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
      }

      await supabase
        .from('stock_transfers')
        .update({ status: 'completed', approved_by: user!.id } as any)
        .eq('id', transfer.id);

      toast({ title: 'Transferência aprovada!', description: 'O estoque foi atualizado.' });
      await loadPendingForMyStore();
    } catch (error: any) {
      toast({ title: 'Erro ao aprovar', description: error.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    const transfer = transfers[currentIndex];
    if (!transfer) return;
    setIsProcessing(true);

    try {
      await supabase
        .from('stock_transfers')
        .update({ status: 'rejected', approved_by: user!.id } as any)
        .eq('id', transfer.id);

      toast({ title: 'Transferência rejeitada' });
      await loadPendingForMyStore();
    } catch (error: any) {
      toast({ title: 'Erro ao rejeitar', description: error.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  if (transfers.length === 0) return null;

  const current = transfers[currentIndex] || transfers[0];

  return (
    <Dialog open={true}>
      <DialogContent
        className="sm:max-w-md [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5 animate-pulse" />
            Solicitação de Transferência
          </DialogTitle>
          <DialogDescription>
            {transfers.length > 1
              ? `Você tem ${transfers.length} solicitações pendentes. Responda cada uma para continuar.`
              : 'Uma loja solicitou peças do seu estoque. Aprove ou recuse para continuar.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {transfers.length > 1 && (
            <Badge variant="outline" className="mb-2">
              {currentIndex + 1} de {transfers.length}
            </Badge>
          )}

          <div className="p-4 rounded-lg border bg-muted/50 space-y-2">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{current.product_name}</span>
            </div>
            {current.variation_label && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Variação:</span>
                <Badge variant="secondary">{current.variation_label}</Badge>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Quantidade:</span>
              <Badge>{current.quantity} un.</Badge>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-destructive">{current.from_store_name}</span>
              <ArrowRight className="h-3 w-3" />
              <span className="font-medium text-primary">{current.to_store_name}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Solicitado por <strong>{current.requester_name}</strong> em{' '}
              {new Date(current.created_at).toLocaleString('pt-BR')}
            </div>
            {current.notes && (
              <p className="text-sm italic text-muted-foreground border-l-2 border-muted pl-2">
                "{current.notes}"
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 sm:gap-2">
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={isProcessing}
            className="flex-1"
          >
            {isProcessing ? 'Processando...' : 'Recusar'}
          </Button>
          <Button
            onClick={handleApprove}
            disabled={isProcessing}
            className="flex-1"
          >
            {isProcessing ? 'Processando...' : 'Aprovar Transferência'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PendingTransferModal;
