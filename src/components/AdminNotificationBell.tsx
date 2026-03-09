import { useState, useEffect } from 'react';
import { Bell, ShoppingBag, ShoppingCart, Check, X, DollarSign, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { AdminNotification, NotificationType, useAdminNotifications } from '@/hooks/useAdminNotifications';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const iconMap: Record<NotificationType, { icon: typeof Bell; bg: string; text: string }> = {
  new_order: { icon: ShoppingBag, bg: 'bg-green-100', text: 'text-green-600' },
  abandoned_cart: { icon: ShoppingCart, bg: 'bg-amber-100', text: 'text-amber-600' },
  pos_sale: { icon: DollarSign, bg: 'bg-blue-100', text: 'text-blue-600' },
  stock_transfer: { icon: PackageCheck, bg: 'bg-purple-100', text: 'text-purple-600' },
};

const routeMap: Record<NotificationType, string> = {
  new_order: '/admin/orders',
  abandoned_cart: '/admin/abandoned-carts',
  pos_sale: '/admin/sales',
  stock_transfer: '/admin/stock',
};

function NotificationToast({ notification, onDismiss }: { notification: AdminNotification; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const { icon: Icon, bg, text } = iconMap[notification.type];

  return (
    <div className="animate-in slide-in-from-right-full fade-in duration-300 bg-card border border-border shadow-lg rounded-lg p-4 max-w-xs w-full flex gap-3 items-start">
      <div className={cn('flex-shrink-0 rounded-full p-2', bg, text)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{notification.title}</p>
        <p className="text-xs text-muted-foreground truncate">{notification.message}</p>
      </div>
      <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground flex-shrink-0">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function AdminNotificationBell() {
  const { isAdmin, isOnlineStore } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useAdminNotifications({ isAdmin, isOnlineStore });
  const [toasts, setToasts] = useState<AdminNotification[]>([]);
  const [prevCount, setPrevCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (notifications.length > prevCount && notifications.length > 0) {
      const newest = notifications[0];
      if (!newest.read) {
        setToasts(prev => [newest, ...prev].slice(0, 3));
      }
    }
    setPrevCount(notifications.length);
  }, [notifications.length]);

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleClick = (notif: AdminNotification) => {
    markAsRead(notif.id);
    const route = routeMap[notif.type];
    if (route) navigate(route);
  };

  const timeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'agora';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  return (
    <>
      {/* Floating toasts */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <NotificationToast notification={t} onDismiss={() => dismissToast(t.id)} />
          </div>
        ))}
      </div>

      {/* Bell icon */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative text-sidebar-foreground hover:bg-sidebar-accent h-9 w-9">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center h-4 min-w-[16px] px-1 text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full animate-in zoom-in">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h4 className="text-sm font-semibold">Notificações</h4>
            <div className="flex gap-1">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllAsRead}>
                  <Check className="h-3 w-3 mr-1" /> Ler tudo
                </Button>
              )}
              {notifications.length > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={clearAll}>
                  Limpar
                </Button>
              )}
            </div>
          </div>

          <ScrollArea className="max-h-80">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Bell className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map(notif => {
                  const { icon: Icon, bg, text } = iconMap[notif.type];
                  return (
                    <button
                      key={notif.id}
                      onClick={() => handleClick(notif)}
                      className={cn(
                        'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50',
                        !notif.read && 'bg-primary/5'
                      )}
                    >
                      <div className={cn('flex-shrink-0 rounded-full p-1.5 mt-0.5', bg, text)}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm', !notif.read && 'font-semibold')}>{notif.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{notif.message}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0 mt-0.5">
                        {timeAgo(notif.createdAt)}
                      </span>
                      {!notif.read && (
                        <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </>
  );
}
