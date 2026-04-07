import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { playNotificationSound, playTransferAlertSound, playServiceOrderSound, playAnnouncementSound } from '@/lib/alertSounds';

export type NotificationType = 'new_order' | 'abandoned_cart' | 'pos_sale' | 'stock_transfer' | 'service_order' | 'announcement';

export interface AdminNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: Date;
  read: boolean;
  entityId?: string;
}

interface NotificationOptions {
  isAdmin: boolean;
  isOnlineStore: boolean;
}

export function useAdminNotifications({ isAdmin, isOnlineStore }: NotificationOptions) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);

  const addNotification = useCallback((notif: Omit<AdminNotification, 'id' | 'createdAt' | 'read'>) => {
    const newNotif: AdminNotification = {
      ...notif,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      read: false,
    };
    setNotifications(prev => [newNotif, ...prev].slice(0, 50));
    // Play differentiated sound by type
    if (notif.type === 'stock_transfer') {
      playTransferAlertSound();
    } else if (notif.type === 'service_order') {
      playServiceOrderSound();
    } else if (notif.type === 'announcement') {
      playAnnouncementSound();
    } else {
      playNotificationSound();
    }
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

  useEffect(() => {
    const channels: ReturnType<typeof supabase.channel>[] = [];

    // Orders & Abandoned Carts — only for online store users or admins
    if (isAdmin || isOnlineStore) {
      const ordersChannel = supabase
        .channel('admin-orders-notifications')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
          const o = payload.new as any;
          addNotification({
            type: 'new_order',
            title: '🛍️ Novo Pedido!',
            message: `${o.customer_name || o.customer_email || 'Cliente'} — ${fmt(o.total)}`,
            entityId: o.id,
          });
        })
        .subscribe();
      channels.push(ordersChannel);

      const cartsChannel = supabase
        .channel('admin-carts-notifications')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'abandoned_carts' }, (payload) => {
          const c = payload.new as any;
          addNotification({
            type: 'abandoned_cart',
            title: '🛒 Carrinho Abandonado',
            message: `${c.customer_name || 'Visitante'} — ${c.item_count || 0} itens (${fmt(c.subtotal)})`,
            entityId: c.id,
          });
        })
        .subscribe();
      channels.push(cartsChannel);
    }

    // POS Sales — for all admin users
    const posChannel = supabase
      .channel('admin-pos-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pos_sales' }, (payload) => {
        const s = payload.new as any;
        addNotification({
          type: 'pos_sale',
          title: '💰 Nova Venda PDV',
          message: `${s.customer_name || 'Cliente'} — ${fmt(s.total)} (${s.payment_method || 'N/A'})`,
          entityId: s.id,
        });
      })
      .subscribe();
    channels.push(posChannel);

    // Stock Transfers — for admins only
    if (isAdmin) {
      const transfersChannel = supabase
        .channel('admin-transfers-notifications')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stock_transfers' }, (payload) => {
          const t = payload.new as any;
          addNotification({
            type: 'stock_transfer',
            title: '📦 Transferência de Estoque',
            message: `${t.quantity || 0} un. — Status: ${t.status || 'pendente'}`,
            entityId: t.id,
          });
        })
        .subscribe();
      channels.push(transfersChannel);
    }

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [addNotification, isAdmin, isOnlineStore]);

  return { notifications, unreadCount, markAsRead, markAllAsRead, clearAll };
}
