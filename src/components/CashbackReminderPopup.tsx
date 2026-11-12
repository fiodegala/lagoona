import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Gift, MessageCircle, Check, ChevronRight, Clock } from 'lucide-react';
import { toast } from 'sonner';
import {
  buildCashbackMessage,
  DEFAULT_CASHBACK_TEMPLATE,
  formatBRL,
  formatDateBR,
  isReminderDue,
  spDateKey,
  spStartOfTodayISO,
  whatsappLink,
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

  const waLink = whatsappLink(current.customer_phone, message);

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

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-3 space-y-1">
            <p className="font-semibold text-base">{current.customer_name}</p>
            <div className="text-sm text-muted-foreground space-y-0.5">
              <p>WhatsApp: {current.customer_phone || <span className="text-destructive">sem telefone cadastrado</span>}</p>
              {current.customer_document && <p>CPF/CNPJ: {current.customer_document}</p>}
              <p>Comprou em {formatDateBR(current.sale_date)} na loja <strong className="text-foreground">{current.store_name || '—'}</strong></p>
            </div>
          </div>

          {current.items?.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium">Peças</p>
              <ul className="text-sm divide-y rounded-lg border max-h-40 overflow-y-auto">
                {current.items.map((it, i) => (
                  <li key={i} className="flex justify-between gap-3 px-3 py-1.5">
                    <span className="min-w-0">{it.quantity}x {it.name}</span>
                    <span className="whitespace-nowrap text-muted-foreground">{formatBRL(it.total)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg border p-2">
              <p className="text-muted-foreground text-xs">Valor da compra</p>
              <p className="font-semibold">{formatBRL(current.sale_total)}</p>
            </div>
            <div className="rounded-lg border border-primary/40 bg-primary/10 p-2">
              <p className="text-muted-foreground text-xs">Cashback ({Number(current.cashback_percent)}%)</p>
              <p className="font-bold text-primary">{formatBRL(current.cashback_value)}</p>
            </div>
            <div className="rounded-lg border p-2">
              <p className="text-muted-foreground text-xs">Compra mínima seguinte</p>
              <p className="font-semibold">{formatBRL(current.min_use_value)}</p>
            </div>
            <div className="rounded-lg border p-2">
              <p className="text-muted-foreground text-xs">Válido até</p>
              <p className="font-semibold">{formatDateBR(current.expires_at)}</p>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Mensagem</p>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} className="text-sm" />
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button className="flex-1" disabled={!waLink} asChild={!!waLink}>
              {waLink ? (
                <a href={waLink} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4 mr-2" /> Abrir WhatsApp
                </a>
              ) : (
                <span><MessageCircle className="h-4 w-4 mr-2 inline" /> Sem WhatsApp</span>
              )}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={markSent} disabled={saving}>
              <Check className="h-4 w-4 mr-2" /> Mensagem enviada
            </Button>
          </div>
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
          <p className="text-xs text-center text-muted-foreground">
            O aviso continua aparecendo até alguém marcar <Badge variant="outline" className="text-[10px]">Mensagem enviada</Badge>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CashbackReminderPopup;
