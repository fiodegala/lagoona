import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Check, Copy, Download, ImagePlus, Upload, Trash2, Share2, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateBR, whatsappLink } from '@/lib/cashback';
import {
  downloadBlobFile,
  formatDayMonthBR,
  imageExtensionFromMime,
  isBirthdayToday,
  type BirthdayReminder,
} from '@/lib/birthdays';

interface Props {
  reminder: BirthdayReminder;
  message: string;
  onMessageChange: (v: string) => void;
  giftImageUrl?: string | null;
  onAttachImage?: (file: File) => void | Promise<void>;
  onRemoveImage?: () => void | Promise<void>;
  onGenerateMessage?: () => void | Promise<void>;
  uploadingImage?: boolean;
  generatingMessage?: boolean;
  attachSavesGlobally?: boolean;
  onMarkSent?: () => void;
  saving?: boolean;
  footer?: ReactNode;
}

/** Corpo do aviso de aniversário — usado no pop-up real e na pré-visualização da página Aniversariantes. */
const BirthdayReminderView = ({
  reminder: r,
  message,
  onMessageChange,
  giftImageUrl,
  onAttachImage,
  onRemoveImage,
  onGenerateMessage,
  uploadingImage,
  generatingMessage,
  attachSavesGlobally,
  onMarkSent,
  saving,
  footer,
}: Props) => {
  const waLink = whatsappLink(r.customer_phone, message);
  const today = isBirthdayToday(r.birthday_date);
  const fileRef = useRef<HTMLInputElement>(null);
  const cachedBlobRef = useRef<{ url: string; blob: Blob } | null>(null);
  const [copyingImg, setCopyingImg] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);

  useEffect(() => {
    if (!giftImageUrl) {
      cachedBlobRef.current = null;
      setCanShareFiles(false);
      return;
    }
    let cancelled = false;
    fetch(giftImageUrl)
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (cancelled || !blob) return;
        cachedBlobRef.current = { url: giftImageUrl, blob };
        try {
          const ext = imageExtensionFromMime(blob.type);
          const file = new File([blob], `brinde-aniversario-fio-de-gala.${ext}`, { type: blob.type || 'image/png' });
          setCanShareFiles(Boolean(navigator.canShare?.({ files: [file] })));
        } catch {
          setCanShareFiles(false);
        }
      })
      .catch(() => {
        if (!cancelled) setCanShareFiles(false);
      });
    return () => {
      cancelled = true;
    };
  }, [giftImageUrl]);

  const getImageBlob = async () => {
    if (!giftImageUrl) return null;
    if (cachedBlobRef.current?.url === giftImageUrl) return cachedBlobRef.current.blob;
    const res = await fetch(giftImageUrl);
    if (!res.ok) throw new Error('Falha ao carregar imagem');
    const blob = await res.blob();
    cachedBlobRef.current = { url: giftImageUrl, blob };
    return blob;
  };

  const copyImage = async () => {
    if (!giftImageUrl) return;
    setCopyingImg(true);
    try {
      const blob = await getImageBlob();
      if (!blob) return;
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
      const blob = await getImageBlob();
      if (!blob) return;
      const ext = imageExtensionFromMime(blob.type);
      downloadBlobFile(blob, `brinde-aniversario-fio-de-gala.${ext}`);
    } catch {
      window.open(giftImageUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const shareImageAndText = async () => {
    if (!giftImageUrl) return;
    try {
      const blob = await getImageBlob();
      if (!blob) return;
      const ext = imageExtensionFromMime(blob.type);
      const file = new File([blob], `brinde-aniversario-fio-de-gala.${ext}`, { type: blob.type || 'image/png' });
      await navigator.share({ files: [file], text: message, title: 'Parabéns Fio de Gala' });
    } catch (e) {
      if ((e as DOMException)?.name !== 'AbortError') {
        toast.error('Não foi possível compartilhar direto. Use "Copiar imagem" ou "Baixar imagem".');
      }
    }
  };

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast.success('Mensagem copiada!');
    } catch {
      toast.error('Não foi possível copiar o texto.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file && onAttachImage) onAttachImage(file);
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

      {(giftImageUrl || onAttachImage) && (
        <div className="space-y-2 rounded-lg border p-2.5 bg-muted/20">
          {onAttachImage && (
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          )}
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              Imagem anexada para enviar junto no WhatsApp
            </p>
            {giftImageUrl && onAttachImage && (
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => fileRef.current?.click()} disabled={uploadingImage}>
                  <Upload className="h-3.5 w-3.5 mr-1" /> Trocar
                </Button>
                {onRemoveImage && (
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive" onClick={onRemoveImage} disabled={uploadingImage} aria-label="Remover imagem">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}
          </div>
          {giftImageUrl ? (
            <>
              <img
                src={giftImageUrl}
                alt="Imagem do brinde de aniversário"
                className="w-full max-h-56 object-contain rounded-md bg-background border"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" className="flex-1" onClick={copyImage} disabled={copyingImg}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> {copyingImg ? 'Copiando...' : 'Copiar imagem'}
                </Button>
                <Button type="button" variant="outline" size="sm" className="flex-1" onClick={downloadImage}>
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Baixar imagem
                </Button>
                {canShareFiles && (
                  <Button type="button" variant="outline" size="sm" className="flex-1" onClick={shareImageAndText}>
                    <Share2 className="h-3.5 w-3.5 mr-1.5" /> Compartilhar tudo
                  </Button>
                )}
              </div>
              {onGenerateMessage && (
                <Button type="button" variant="secondary" size="sm" className="w-full" onClick={onGenerateMessage} disabled={generatingMessage || uploadingImage}>
                  {generatingMessage ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                  {generatingMessage ? 'Criando mensagem com IA...' : 'Criar mensagem com IA usando esta imagem'}
                </Button>
              )}
              <p className="text-[11px] text-muted-foreground">
                No WhatsApp Web: clique em <strong>Copiar imagem</strong>, abra a conversa e cole (Ctrl+V).
              </p>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-full h-auto py-4 border-dashed flex flex-col items-center gap-1.5 whitespace-normal"
              onClick={() => fileRef.current?.click()}
              disabled={uploadingImage}
            >
              {uploadingImage ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                <ImagePlus className="h-5 w-5 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">
                {uploadingImage ? 'Enviando imagem...' : 'Anexar imagem junto da mensagem'}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {attachSavesGlobally
                  ? 'Fica salva para quem for enviar o aviso pegar e mandar no WhatsApp.'
                  : 'Anexe uma foto do brinde para copiar ou baixar e enviar junto no WhatsApp.'}
              </span>
            </Button>
          )}
        </div>
      )}

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Mensagem</p>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={copyMessage}>
            <Copy className="h-3.5 w-3.5 mr-1" /> Copiar texto
          </Button>
        </div>
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