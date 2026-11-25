import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Cake, ChevronRight, Clock } from 'lucide-react';
import BirthdayReminderView from '@/components/BirthdayReminderView';
import { toast } from 'sonner';
import {
  buildBirthdayMessage,
  DEFAULT_BIRTHDAY_TEMPLATE,
  fetchAllBirthdayReminders,
} from '@/lib/birthdays';

const SNOOZE_KEY = 'birthday-popup-snoozed';

const BirthdayReminderPopup = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [doneKeys, setDoneKeys] = useState<Set<string>>(new Set());
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(null);
  const [localImageRemoved, setLocalImageRemoved] = useState(false);

  const { data: viewer } = useQuery({
    queryKey: ['birthday-viewer', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('birthday_viewers')
        .select('user_id, all_stores, store_ids')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: settings } = useQuery({
    queryKey: ['birthday-template'],
    enabled: !!viewer,
    queryFn: async () => {
      const { data } = await supabase
        .from('birthday_settings')
        .select('enabled, message_template, gift_image_url')
        .eq('id', 1)
        .maybeSingle();
      return data ?? { enabled: true, message_template: DEFAULT_BIRTHDAY_TEMPLATE, gift_image_url: null };
    },
  });

  const { data: reminders = [] } = useQuery({
    queryKey: ['birthday-due-reminders', user?.id, viewer?.all_stores, (viewer?.store_ids || []).join(',')],
    enabled: !!viewer && (viewer.all_stores || (viewer.store_ids || []).length > 0) && settings?.enabled !== false,
    refetchInterval: 10 * 60 * 1000,
    queryFn: () => fetchAllBirthdayReminders(null, true),
  });

  const itemKey = (r: { customer_id: string; birthday_year: number }) => `${r.customer_id}:${r.birthday_year}`;
  const queue = reminders.filter((r) => !doneKeys.has(itemKey(r)));
  const current = queue[Math.min(index, Math.max(queue.length - 1, 0))];

  useEffect(() => {
    if (queue.length > 0 && !open && sessionStorage.getItem(SNOOZE_KEY) !== '1') setOpen(true);
    if (queue.length === 0 && open) setOpen(false);
  }, [queue.length, open]);

  useEffect(() => {
    if (current) setMessage(buildBirthdayMessage(settings?.message_template, current));
  }, [current?.customer_id, current?.birthday_year, settings?.message_template]);

  useEffect(() => {
    return () => {
      if (localImageUrl) URL.revokeObjectURL?.(localImageUrl);
    };
  }, [localImageUrl]);

  if (!open || !current) return null;

  const effectiveImageUrl = localImageUrl ?? (localImageRemoved ? null : settings?.gift_image_url ?? null);

  const handleAttachLocalImage = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem (JPG, PNG ou WebP).');
      return;
    }
    if (localImageUrl) URL.revokeObjectURL?.(localImageUrl);
    setLocalImageUrl(URL.createObjectURL(file));
    setLocalImageRemoved(false);
    toast.success('Imagem anexada! Use "Copiar imagem" ou "Baixar imagem" para enviar junto.');
  };

  const handleRemoveLocalImage = () => {
    if (localImageUrl) URL.revokeObjectURL?.(localImageUrl);
    setLocalImageUrl(null);
    setLocalImageRemoved(true);
  };

  const remindLater = () => {
    sessionStorage.setItem(SNOOZE_KEY, '1');
    setOpen(false);
  };

  const skip = () => setIndex((i) => (i + 1) % queue.length);

  const markSent = async () => {
    setSaving(true);
    const { error } = await supabase.rpc('set_birthday_reminder_status', {
      _customer_id: current.customer_id,
      _year: current.birthday_year,
      _status: 'sent',
    });
    setSaving(false);
    if (error) {
      toast.error('Não foi possível marcar como enviada: ' + error.message);
      return;
    }
    toast.success(`Parabéns para ${current.customer_name} marcado como enviado`);
    setDoneKeys((prev) => new Set(prev).add(itemKey(current)));
    queryClient.invalidateQueries({ queryKey: ['birthday-due-reminders'] });
    queryClient.invalidateQueries({ queryKey: ['birthday-reminders-admin'] });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) remindLater(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cake className="h-5 w-5 text-primary" />
            Aniversariante para parabenizar no WhatsApp
          </DialogTitle>
          <DialogDescription>
            {queue.length > 1
              ? `${Math.min(index, queue.length - 1) + 1} de ${queue.length} aniversariantes para avisar`
              : '1 aniversariante para avisar'}
          </DialogDescription>
        </DialogHeader>

        <BirthdayReminderView
          reminder={current}
          message={message}
          onMessageChange={setMessage}
          giftImageUrl={effectiveImageUrl}
          onAttachImage={handleAttachLocalImage}
          onRemoveImage={handleRemoveLocalImage}
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

export default BirthdayReminderPopup;