import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import promoImage from '@/assets/brasil-haiti-promo.png.asset.json';

const STORAGE_KEY = 'score_prediction_popup_v1';

const ScorePredictionPopup = () => {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    whatsapp: '',
    score_brasil: '',
    score_haiti: '',
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const already = localStorage.getItem(STORAGE_KEY);
    if (already) return;
    const t = setTimeout(() => setOpen(true), 2500);
    return () => clearTimeout(t);
  }, []);

  const formatWhatsapp = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = form.whatsapp.replace(/\D/g, '');
    if (!form.full_name.trim() || form.full_name.trim().length < 3) {
      toast.error('Informe seu nome completo');
      return;
    }
    if (digits.length < 10 || digits.length > 11) {
      toast.error('WhatsApp inválido');
      return;
    }
    if (form.score_brasil === '' || form.score_haiti === '') {
      toast.error('Informe o placar do jogo');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('score_predictions' as any).insert({
        full_name: form.full_name.trim(),
        whatsapp: digits,
        score_brasil: parseInt(form.score_brasil, 10),
        score_haiti: parseInt(form.score_haiti, 10),
      });
      if (error) throw error;
      localStorage.setItem(STORAGE_KEY, '1');
      toast.success('Palpite enviado! Boa sorte!');
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar palpite. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
      <DialogContent className="p-0 max-w-[95vw] md:max-w-3xl bg-[#0a1933] border-store-gold/40 overflow-hidden h-auto max-h-[85dvh] md:max-h-[90dvh] flex flex-col !top-4 md:!top-[50%] !translate-y-0 md:!translate-y-[-50%]">
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 bg-black/60 hover:bg-black text-white rounded-full p-1.5 transition"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="grid md:grid-cols-2 overflow-y-auto">
          <div className="bg-[#0a1933] md:h-auto">
            <img
              src={promoImage.url}
              alt="Brasil x Haiti - Acerte o placar e ganhe"
              className="w-full h-auto object-contain md:object-cover md:h-full md:max-h-none"
            />
          </div>
          <form onSubmit={handleSubmit} className="p-4 md:p-6 flex flex-col gap-3 md:gap-4 bg-[#0a1933] text-white">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-store-gold leading-tight">
                ACERTE O PLACAR E GANHE!
              </h2>
              <p className="text-xs md:text-sm text-white/80 mt-1">
                Deixe seus dados e o placar do jogo Brasil x Haiti. Quem acertar ganha um super presente da Fio de Gala direto no WhatsApp!
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sp-name" className="text-white">Nome completo</Label>
              <Input
                id="sp-name"
                value={form.full_name}
                onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                placeholder="Seu nome completo"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sp-wa" className="text-white">WhatsApp</Label>
              <Input
                id="sp-wa"
                value={form.whatsapp}
                onChange={(e) => setForm((p) => ({ ...p, whatsapp: formatWhatsapp(e.target.value) }))}
                placeholder="(00) 00000-0000"
                inputMode="tel"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white">Placar do jogo</Label>
              <div className="flex items-center gap-3">
                <div className="flex-1 text-center">
                  <div className="text-xs text-white/70 mb-1">BRASIL</div>
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    value={form.score_brasil}
                    onChange={(e) => setForm((p) => ({ ...p, score_brasil: e.target.value }))}
                    className="bg-white/10 border-white/20 text-white text-center text-xl font-bold"
                    required
                  />
                </div>
                <div className="text-store-gold text-2xl font-bold pt-5">X</div>
                <div className="flex-1 text-center">
                  <div className="text-xs text-white/70 mb-1">HAITI</div>
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    value={form.score_haiti}
                    onChange={(e) => setForm((p) => ({ ...p, score_haiti: e.target.value }))}
                    className="bg-white/10 border-white/20 text-white text-center text-xl font-bold"
                    required
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="bg-store-gold hover:bg-store-gold/90 text-store-dark font-bold mt-2"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar palpite
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScorePredictionPopup;
