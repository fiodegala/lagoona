import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Check } from 'lucide-react';
import { formatBRL, formatDateBR, whatsappLink, type CashbackReminder } from '@/lib/cashback';

interface Props {
  reminder: CashbackReminder;
  message: string;
  onMessageChange: (v: string) => void;
  onMarkSent?: () => void;
  saving?: boolean;
  /** Linha de baixo (Lembrar depois / Próximo / Fechar). */
  footer?: ReactNode;
}

/** Corpo do aviso de cashback — usado no pop-up real e na pré-visualização da página Cashback. */
const CashbackReminderView = ({ reminder: r, message, onMessageChange, onMarkSent, saving, footer }: Props) => {
  const waLink = whatsappLink(r.customer_phone, message);
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/40 p-3 space-y-1">
        <p className="font-semibold text-base">{r.customer_name}</p>
        <div className="text-sm text-muted-foreground space-y-0.5">
          <p>WhatsApp: {r.customer_phone || <span className="text-destructive">sem telefone cadastrado</span>}</p>
          {r.customer_document && <p>CPF/CNPJ: {r.customer_document}</p>}
          <p>Comprou em {formatDateBR(r.sale_date)} na loja <strong className="text-foreground">{r.store_name || '—'}</strong></p>
        </div>
      </div>

      {r.items?.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium">Peças</p>
          <ul className="text-sm divide-y rounded-lg border max-h-40 overflow-y-auto">
            {r.items.map((it, i) => (
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
          <p className="font-semibold">{formatBRL(r.sale_total)}</p>
        </div>
        <div className="rounded-lg border border-primary/40 bg-primary/10 p-2">
          <p className="text-muted-foreground text-xs">Cashback ({Number(r.cashback_percent)}%)</p>
          <p className="font-bold text-primary">{formatBRL(r.cashback_value)}</p>
        </div>
        <div className="rounded-lg border p-2">
          <p className="text-muted-foreground text-xs">Compra mínima seguinte</p>
          <p className="font-semibold">{formatBRL(r.min_use_value)}</p>
        </div>
        <div className="rounded-lg border p-2">
          <p className="text-muted-foreground text-xs">Válido até</p>
          <p className="font-semibold">{formatDateBR(r.expires_at)}</p>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium">Mensagem</p>
        <Textarea value={message} onChange={(e) => onMessageChange(e.target.value)} rows={5} className="text-sm" />
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
        {onMarkSent && (
          <Button variant="secondary" className="flex-1" onClick={onMarkSent} disabled={saving}>
            <Check className="h-4 w-4 mr-2" /> Mensagem enviada
          </Button>
        )}
      </div>
      {footer}
      <p className="text-xs text-center text-muted-foreground">
        O aviso continua aparecendo até alguém marcar <Badge variant="outline" className="text-[10px]">Mensagem enviada</Badge>
      </p>
    </div>
  );
};

export default CashbackReminderView;
