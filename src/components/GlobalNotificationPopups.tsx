import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { playServiceOrderSound, playTransferAlertSound } from '@/lib/alertSounds';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ClipboardList, Clock, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

interface PendingItem {
  id: string;
  type: 'service_order' | 'stock_transfer' | 'announcement';
  title: string;
  description: string;
  extra?: Record<string, any>;
  createdAt: string;
  snoozedUntil?: number; // timestamp
}

const SNOOZE_MINUTES = 5;

const GlobalNotificationPopups = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, userStoreId, accessibleStoreIds } = useAuth();
  const [items, setItems] = useState<PendingItem[]>([]);
  const [currentItem, setCurrentItem] = useState<PendingItem | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const snoozeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const processedIdsRef = useRef<Set<string>>(new Set());
  const dismissedIdsRef = useRef<Set<string>>(new Set());

  const isOnServiceOrdersPage = location.pathname === '/admin/ordens-servico';

  // Load pending service orders for this user
  const loadPendingServiceOrders = useCallback(async () => {
    if (!user) return [];
    
    // Get departments this user manages
    const { data: myDepts } = await supabase
      .from('department_managers')
      .select('department_id')
      .eq('user_id', user.id);
    
    const deptIds = (myDepts || []).map(d => d.department_id);
    
    // Get department names
    let deptNames: string[] = [];
    if (deptIds.length > 0) {
      const { data: depts } = await supabase
        .from('service_order_departments')
        .select('name')
        .in('id', deptIds);
      deptNames = (depts || []).map(d => d.name);
    }
    
    // Get pending OS assigned to user's departments (or all if admin)
    let query = supabase
      .from('service_orders')
      .select('*')
      .in('status', ['open', 'awaiting_approval'])
      .order('created_at', { ascending: false });

    const { data: orders } = await query;
    
    if (!orders) return [];
    
    // Filter: admin sees all, managers see their departments
    const filtered = orders.filter(o => {
      if (isAdmin) return true;
      return deptNames.includes(o.department);
    });
    
    return filtered.map(o => ({
      id: `os-${o.id}`,
      type: 'service_order' as const,
      title: `📋 Ordem de Serviço: ${o.title}`,
      description: `Departamento: ${o.department} | Prioridade: ${o.priority}`,
      extra: { orderId: o.id, department: o.department, priority: o.priority, osTitle: o.title },
      createdAt: o.created_at,
    }));
  }, [user, isAdmin]);

  // Load pending stock transfers for this user's store  
  const loadPendingTransfers = useCallback(async () => {
    if (!userStoreId) return [];
    
    // Get store types
    const { data: storesData } = await supabase.from('stores').select('id, name, type');
    const storeMap: Record<string, string> = {};
    const storeTypeMap: Record<string, string> = {};
    (storesData || []).forEach(s => { storeMap[s.id] = s.name; storeTypeMap[s.id] = s.type; });
    
    // Skip for online stores
    const userStoreType = storeTypeMap[userStoreId];
    if (userStoreType === 'online' || userStoreType === 'website') return [];
    
    const storeIds = accessibleStoreIds.length > 0
      ? accessibleStoreIds.filter(id => {
          const t = storeTypeMap[id];
          return t !== 'online' && t !== 'website';
        })
      : [userStoreId];
    
    if (storeIds.length === 0) return [];
    
    const { data } = await supabase
      .from('stock_transfers')
      .select('*')
      .eq('status', 'pending')
      .in('from_store_id', storeIds)
      .order('created_at', { ascending: true });
    
    if (!data || data.length === 0) return [];
    
    // Enrich with product names
    const productIds = [...new Set(data.map(t => t.product_id))];
    const { data: prods } = await supabase.from('products').select('id, name').in('id', productIds);
    const prodMap: Record<string, string> = {};
    (prods || []).forEach(p => { prodMap[p.id] = p.name; });
    
    return data.map(t => ({
      id: `transfer-${t.id}`,
      type: 'stock_transfer' as const,
      title: `📦 Transferência: ${prodMap[t.product_id] || 'Produto'}`,
      description: `${t.quantity} un. | ${storeMap[t.from_store_id] || '?'} → ${storeMap[t.to_store_id] || '?'}`,
      extra: { transferId: t.id, quantity: t.quantity, fromStore: storeMap[t.from_store_id], toStore: storeMap[t.to_store_id], productName: prodMap[t.product_id] },
      createdAt: t.created_at,
    }));
  }, [userStoreId, accessibleStoreIds]);

  // Load all pending items
  const loadAll = useCallback(async () => {
    const [osItems, transferItems] = await Promise.all([
      loadPendingServiceOrders(),
      loadPendingTransfers(),
    ]);
    
    const allItems = [...osItems, ...transferItems];
    setItems(allItems);
    
    // Play sound for new items
    const newIds = allItems.map(i => i.id).filter(id => !processedIdsRef.current.has(id));
    if (newIds.length > 0) {
      const hasNewOS = newIds.some(id => id.startsWith('os-'));
      const hasNewTransfer = newIds.some(id => id.startsWith('transfer-'));
      
      if (hasNewTransfer) playTransferAlertSound();
      else if (hasNewOS && !isOnServiceOrdersPage) playServiceOrderSound();
      
      newIds.forEach(id => processedIdsRef.current.add(id));
      
      // Show toast for each new item (skip OS toasts when on OS page)
      allItems.filter(i => newIds.includes(i.id)).forEach(item => {
        if (item.type === 'service_order' && !isOnServiceOrdersPage) {
          toast.info('📋 Nova Ordem de Serviço pendente', { description: item.extra?.osTitle });
        } else if (item.type === 'stock_transfer') {
          toast.warning('📦 Transferência pendente', { description: item.description });
        }
      });
    }
  }, [loadPendingServiceOrders, loadPendingTransfers, isOnServiceOrdersPage]);

  // Initial load + realtime subscriptions
  useEffect(() => {
    if (!user) return;
    
    loadAll();
    
    const osChannel = supabase
      .channel('global-os-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_orders' }, () => {
        loadAll();
      })
      .subscribe();
    
    const transferChannel = supabase
      .channel('global-transfer-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_transfers' }, () => {
        loadAll();
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(osChannel);
      supabase.removeChannel(transferChannel);
    };
  }, [user, loadAll]);

  // Show popup for first unsnoozed item
  useEffect(() => {
    const now = Date.now();
    const unsnoozed = items.filter(i => !i.snoozedUntil || i.snoozedUntil <= now)
      .filter(i => !dismissedIdsRef.current.has(i.id));
    
    if (unsnoozed.length > 0 && !showPopup) {
      setCurrentItem(unsnoozed[0]);
      setShowPopup(true);
    } else if (unsnoozed.length === 0) {
      setShowPopup(false);
      setCurrentItem(null);
    }
  }, [items, showPopup]);

  // Snooze timer - check every 30s if any snoozed items have expired
  useEffect(() => {
    snoozeTimerRef.current = setInterval(() => {
      const now = Date.now();
      setItems(prev => {
        const updated = prev.map(i => {
          if (i.snoozedUntil && i.snoozedUntil <= now) {
            return { ...i, snoozedUntil: undefined };
          }
          return i;
        });
        // Check if any became unsnoozed
        const unsnoozed = updated.filter(i => !i.snoozedUntil);
        if (unsnoozed.length > 0 && !showPopup) {
          setCurrentItem(unsnoozed[0]);
          setShowPopup(true);
          // Play sound on reminder
          if (unsnoozed[0].type === 'stock_transfer') playTransferAlertSound();
          else if (unsnoozed[0].type === 'service_order') playServiceOrderSound();
        }
        return updated;
      });
    }, 30000);
    
    return () => {
      if (snoozeTimerRef.current) clearInterval(snoozeTimerRef.current);
    };
  }, [showPopup]);

  const handleSnooze = () => {
    if (!currentItem) return;
    const snoozeUntil = Date.now() + SNOOZE_MINUTES * 60 * 1000;
    
    setItems(prev => prev.map(i => 
      i.id === currentItem.id ? { ...i, snoozedUntil: snoozeUntil } : i
    ));
    setShowPopup(false);
    setCurrentItem(null);
    
    toast.info(`Lembrete em ${SNOOZE_MINUTES} minutos`, { description: currentItem.title });
    
    // Show next unsnoozed item if any
    setTimeout(() => {
      setItems(prev => {
        const unsnoozed = prev.filter(i => !i.snoozedUntil && i.id !== currentItem.id);
        if (unsnoozed.length > 0) {
          setCurrentItem(unsnoozed[0]);
          setShowPopup(true);
        }
        return prev;
      });
    }, 300);
  };

  const handleDismissAndNext = () => {
    if (!currentItem) return;
    
    // Remove from list (it was actioned externally)
    setItems(prev => {
      const remaining = prev.filter(i => i.id !== currentItem.id);
      const unsnoozed = remaining.filter(i => !i.snoozedUntil);
      if (unsnoozed.length > 0) {
        setCurrentItem(unsnoozed[0]);
      } else {
        setShowPopup(false);
        setCurrentItem(null);
      }
      return remaining;
    });
  };

  if (!showPopup || !currentItem) return null;

  const isOS = currentItem.type === 'service_order';
  const isTransfer = currentItem.type === 'stock_transfer';

  const pendingCount = items.filter(i => !i.snoozedUntil).length;

  return (
    <Dialog open={showPopup}>
      <DialogContent
        className="sm:max-w-md [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isOS && <ClipboardList className="h-5 w-5 text-amber-600 animate-pulse" />}
            {isTransfer && <AlertTriangle className="h-5 w-5 text-destructive animate-pulse" />}
            {isOS ? 'Ordem de Serviço Pendente' : 'Solicitação de Transferência'}
          </DialogTitle>
          <DialogDescription>
            {pendingCount > 1
              ? `Você tem ${pendingCount} itens pendentes. Resolva cada um para continuar.`
              : 'Ação necessária. Aprove, revise ou adie para lembrar depois.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {pendingCount > 1 && (
            <Badge variant="outline">
              {items.filter(i => !i.snoozedUntil).indexOf(currentItem) + 1} de {pendingCount}
            </Badge>
          )}

          <div className="p-4 rounded-lg border bg-muted/50 space-y-2">
            <p className="font-semibold text-sm">{currentItem.title}</p>
            <p className="text-sm text-muted-foreground">{currentItem.description}</p>
            {isTransfer && currentItem.extra && (
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-destructive">{currentItem.extra.fromStore}</span>
                <ArrowRight className="h-3 w-3" />
                <span className="font-medium text-primary">{currentItem.extra.toStore}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {new Date(currentItem.createdAt).toLocaleString('pt-BR')}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleSnooze}
            className="flex items-center gap-2"
          >
            <Clock className="h-4 w-4" />
            Lembrar em {SNOOZE_MINUTES}min
          </Button>
          <Button
            variant="default"
            onClick={() => {
              const route = isOS ? '/admin/ordens-servico' : '/admin/stock';
              dismissedIdsRef.current.add(currentItem.id);
              handleDismissAndNext();
              navigate(route);
            }}
          >
            {isOS ? 'Ir para Ordens de Serviço' : 'Ir para Estoque'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GlobalNotificationPopups;
