import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AdminNotification {
  id: string;
  type: 'new_order' | 'abandoned_cart';
  title: string;
  message: string;
  createdAt: Date;
  read: boolean;
  entityId?: string;
}

export function useAdminNotifications() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playSound = useCallback(() => {
    try {
      // Simple beep using Web Audio API
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.3;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  }, []);

  const addNotification = useCallback((notif: Omit<AdminNotification, 'id' | 'createdAt' | 'read'>) => {
    const newNotif: AdminNotification = {
      ...notif,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      read: false,
    };
    setNotifications(prev => [newNotif, ...prev].slice(0, 50));
    playSound();
  }, [playSound]);

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

  useEffect(() => {
    // Listen to new orders
    const ordersChannel = supabase
      .channel('admin-orders-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          const order = payload.new as any;
          const total = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total || 0);
          addNotification({
            type: 'new_order',
            title: '🛍️ Novo Pedido!',
            message: `${order.customer_name || order.customer_email || 'Cliente'} — ${total}`,
            entityId: order.id,
          });
        }
      )
      .subscribe();

    // Listen to abandoned carts
    const cartsChannel = supabase
      .channel('admin-carts-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'abandoned_carts' },
        (payload) => {
          const cart = payload.new as any;
          const total = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cart.subtotal || 0);
          addNotification({
            type: 'abandoned_cart',
            title: '🛒 Carrinho Abandonado',
            message: `${cart.customer_name || 'Visitante'} — ${cart.item_count || 0} itens (${total})`,
            entityId: cart.id,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(cartsChannel);
    };
  }, [addNotification]);

  return { notifications, unreadCount, markAsRead, markAllAsRead, clearAll };
}
