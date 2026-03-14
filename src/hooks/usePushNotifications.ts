import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function usePushNotifications() {
  const { user, isAdmin } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);
    if (supported) {
      setPermission(Notification.permission);
      checkExistingSubscription();
    }
  }, []);

  const checkExistingSubscription = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch {
      setIsSubscribed(false);
    }
  }, []);

  const getVapidPublicKey = useCallback(async (): Promise<string | null> => {
    // Try to get from store_config
    const { data } = await supabase
      .from('store_config')
      .select('value')
      .eq('key', 'vapid_public_key')
      .single();

    if (data) {
      return (data.value as any).key;
    }

    // Generate keys if admin
    if (isAdmin) {
      const { data: genData, error } = await supabase.functions.invoke('generate-vapid-keys');
      if (error) {
        console.error('Error generating VAPID keys:', error);
        return null;
      }
      return genData?.publicKey || null;
    }

    return null;
  }, [isAdmin]);

  const subscribe = useCallback(async () => {
    if (!isSupported || !user) return false;

    setIsLoading(true);
    try {
      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        toast.error('Permissão de notificação negada');
        return false;
      }

      const vapidKey = await getVapidPublicKey();
      if (!vapidKey) {
        toast.error('Chaves de push não configuradas. Peça ao admin para configurar.');
        return false;
      }

      // Convert base64url to Uint8Array
      const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
      };

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const subJson = subscription.toJSON();

      // Save to database
      const { error } = await supabase
        .from('push_subscriptions' as any)
        .upsert({
          user_id: user.id,
          endpoint: subJson.endpoint,
          subscription: subJson,
          is_active: true,
        }, { onConflict: 'endpoint' });

      if (error) {
        console.error('Error saving subscription:', error);
        toast.error('Erro ao salvar inscrição push');
        return false;
      }

      setIsSubscribed(true);
      toast.success('Notificações push ativadas!');
      return true;

    } catch (err) {
      console.error('Push subscription error:', err);
      toast.error('Erro ao ativar notificações push');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, user, getVapidPublicKey]);

  const unsubscribe = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();

        // Deactivate in database
        await supabase
          .from('push_subscriptions' as any)
          .update({ is_active: false })
          .eq('endpoint', subscription.endpoint);
      }
      setIsSubscribed(false);
      toast.success('Notificações push desativadas');
    } catch (err) {
      console.error('Unsubscribe error:', err);
    }
  }, []);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe,
  };
}
