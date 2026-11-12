import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Gift, ChevronRight, Clock } from 'lucide-react';
import CashbackReminderView from '@/components/CashbackReminderView';
import { toast } from 'sonner';
import {
  buildCashbackMessage,
  DEFAULT_CASHBACK_TEMPLATE,
  isReminderDue,
  spDateKey,
  spStartOfTodayISO,
  type CashbackReminder,
} from '@/lib/cashback';

const SNOOZE_KEY = 'cashback-popup-snoozed';

const CashbackReminderPopup = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  const { data: viewer } = useQuery({
    queryKey: ['cashback-viewer', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('cashback_viewers').select('user_id, all_stores, store_ids').eq('user_id', user!.id).maybeSingle();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: template = DEFAULT_CASHBACK_TEMPLATE } = useQuery({
    queryKey: ['cashback-template'],
    enabled: !!viewer,
    queryFn: async () => {
      const { data } = await supabase.from('cashback_settings').select('message_template').eq('id', 1).maybeSingle();
      return data?.message_template || DEFAULT_CASHBACK_TEMPLATE;
    },
  });

  const { data: reminders = [] } = useQuery({
    queryKey: ['cashback-due-reminders', user?.id, viewer?.all_stores, (viewer?.store_ids || []).join(',')],
    enabled: !!viewer && (viewer.all_stores || (viewer.store_ids || []).length > 0),
    refetchInterval: 10 * 60 * 1000,
    queryFn: async () => {
      const now = new Date();
      let q = supabase
        .from('cashback_reminders')
        .select('*')
        .eq('status', 'pending')
        .lt('sale_date', spStartOfTodayISO(now))
        .gte('expires_at', spDateKey(now));
      // Mesmo para administradores, o aviso mostra só as lojas marcadas para o usuário.
      if (!viewer!.all_stores) q = q.in('store_id', viewer!.store_ids);
      const { data, error } = await q.order('sale_date', { ascending: true }).limit(300);
      if (error) throw error;
      return ((data || []) as unknown as CashbackReminder[]).filter((r) => isReminderDue(r, now));
    },
  });

  const queue = reminders.filter((r) => !doneIds.has(r.id));
  const current = queue[Math.min(index, Math.max(queue.length - 1, 0))];

  useEffect(() => {
    if (queue.length > 0 && !open && sessionStorage.getItem(SNOOZE_KEY) !== '1') setOpen(true);
    if (queue.length === 0 && open) setOpen(false);
  }, [queue.length, open]);

  useEffect(() => {
    if (current) setMessage(buildCashbackMessage(template, current));
  }, [current?.id, template]);

  if (!open || !current) return null;

  const remindLater = () => {
    sessionStorage.setItem(SNOOZE_KEY, '1');
    setOpen(false);
  };

  const skip = () => {
    setIndex((i) => (i + 1) % queue.length);
  };

  const markSent = async () => {
    setSaving(true);
    const { error } = await supabase.rpc('set_cashback_reminder_status', { _reminder_id: current.id, _status: 'sent' });
    setSaving(false);
    if (error) {
      toast.error('Não foi possível marcar como enviada: ' + error.message);
      return;
    }
    toast.success(`Cashback de ${current.customer_name} marcado como enviado`);
    setDoneIds((prev) => new Set(prev).add(current.id));
    queryClient.invalidateQueries({ queryKey: ['cashback-due-reminders'] });
    queryClient.invalidateQueries({ queryKey: ['cashback-reminders-admin'] });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) remindLater(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Cashback para avisar no WhatsApp
          </DialogTitle>
          <DialogDescription>
            {queue.length > 1 ? `${Math.min(index, queue.length - 1) + 1} de ${queue.length} clientes para avisar` : '1 cliente para avisar'}
          </DialogDescription>
        </DialogHeader>

        <CashbackReminderView
          reminder={current}
          message={message}
          onMessageChange={setMessage}
          onMarkSent={markSent}
          saving={saving}
          footer={
            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={remindLater}>
                <Clock className="h-4 w-4 mr-1" /> Lembrar depois
              </Button>
              {queue.length > 1 && (
                <Button variant="ghost" size="sm" onClick={skip}>
                  Próximo <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          }
        />
      </DialogContent>
    </Dialog>
  );
};

export default CashbackReminderPopup;
