import type { ReactNode } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Check, Copy, Download } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateBR, whatsappLink } from '@/lib/cashback';
import { formatDayMonthBR, isBirthdayToday, type BirthdayReminder } from '@/lib/birthdays';

interface Props {
  reminder: BirthdayReminder;
  message: string;
  onMessageChange: (v: string) => void;
  giftImageUrl?: string | null;
  onMarkSent?: () => void;
  saving?: boolean;
  footer?: ReactNode;
}

/** Corpo do aviso de aniversário — usado no pop-up real e na pré-visualização da página Aniversariantes. */
const BirthdayReminderView = ({ reminder: r, message, onMessageChange, giftImageUrl, onMarkSent, saving, footer }: Props) => {
  const waLink = whatsappLink(r.customer_phone, message);
  const today = isBirthdayToday(r.birthday_date);
  const [copyingImg, setCopyingImg] = useState(false);

  const copyImage = async () => {
    if (!giftImageUrl) return;
    setCopyingImg(true);
    try {
      const res = await fetch(giftImageUrl);
      const blob = await res.blob();
      let pngBlob = blob;
      if (blob.type !== 'image/png') {
        const bmp = await createImageBitmap(blob);
        const canvas = document.createElement('canvas');
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        canvas.getContext('2d')?.drawImage(bmp, 0, 0);
        pngBlob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao converter imagem'))), 'image/png'),
        );
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
      toast.success('Imagem copiada! Cole (Ctrl+V) direto na conversa do WhatsApp.');
    } catch {
      toast.error('Não foi possível copiar a imagem neste navegador. Use "Baixar imagem".');
    } finally {
      setCopyingImg(false);
    }
  };

  const downloadImage = async () => {
    if (!giftImageUrl) return;
    try {
      const res = await fetch(giftImageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'brinde-aniversario-fio-de-gala.png';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(giftImageUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/40 p-3 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-base">{r.customer_name}</p>
          {today && <Badge>Hoje!</Badge>}
        </div>
        <div className="text-sm text-muted-foreground space-y-0.5">
          <p>WhatsApp: {r.customer_phone || <span className="text-destructive">sem telefone cadastrado</span>}</p>
          {r.customer_document && <p>CPF/CNPJ: {r.customer_document}</p>}
          <p>Loja: <strong className="text-foreground">{r.store_name || 'Sem loja vinculada'}</strong></p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg border border-primary/40 bg-primary/10 p-2">
          <p className="text-muted-foreground text-xs">Aniversário</p>
          <p className="font-bold text-primary">{formatDayMonthBR(r.birthday_date)}</p>
        </div>
        <div className="rounded-lg border p-2">
          <p className="text-muted-foreground text-xs">Nascimento / Idade</p>
          <p className="font-semibold">
            {formatDateBR(r.birthday)}
            {r.turning_age > 0 ? ` (${r.turning_age} anos)` : ''}
          </p>
        </div>
      </div>

      {giftImageUrl && (
        <div className="space-y-2 rounded-lg border p-2.5 bg-muted/20">
          <p className="text-xs font-medium text-muted-foreground">Imagem do brinde para enviar junto no WhatsApp</p>
          <img
            src={giftImageUrl}
            alt="Imagem do brinde de aniversário"
            className="w-full max-h-52 object-contain rounded-md bg-background border"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="flex-1" onClick={copyImage} disabled={copyingImg}>
              <Copy className="h-3.5 w-3.5 mr-1.5" /> {copyingImg ? 'Copiando...' : 'Copiar imagem'}
            </Button>
            <Button type="button" variant="outline" size="sm" className="flex-1" onClick={downloadImage}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Baixar imagem
            </Button>
          </div>
        </div>
      )}

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
      <div className="text-xs text-center text-muted-foreground">
        O aviso continua aparecendo até alguém marcar <Badge variant="outline" className="text-[10px]">Mensagem enviada</Badge>
      </div>
    </div>
  );
};

export default BirthdayReminderView;