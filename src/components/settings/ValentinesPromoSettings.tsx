import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Clock, Heart, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  DEFAULT_VALENTINES_CONFIG,
  VALENTINES_CONFIG_KEY,
  type ValentinesPromoConfig,
} from '@/lib/valentinesPromo';
import { invalidateValentinesPromo } from '@/hooks/useValentinesPromo';

const toLocalParts = (iso: string | null) => {
  if (!iso) return { date: undefined as Date | undefined, time: '00:00' };
  const d = new Date(iso);
  return {
    date: d,
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
  };
};

const combineDateTime = (date: Date | undefined, time: string): string | null => {
  if (!date) return null;
  const [h, m] = time.split(':').map(Number);
  const d = new Date(date);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toISOString();
};

const ValentinesPromoSettings = () => {
  const [config, setConfig] = useState<ValentinesPromoConfig>(DEFAULT_VALENTINES_CONFIG);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [startTime, setStartTime] = useState('00:00');
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [endTime, setEndTime] = useState('23:59');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('store_config')
          .select('value')
          .eq('key', VALENTINES_CONFIG_KEY)
          .maybeSingle();
        if (data?.value) {
          const cfg = { ...DEFAULT_VALENTINES_CONFIG, ...(data.value as Partial<ValentinesPromoConfig>) };
          setConfig(cfg);
          const s = toLocalParts(cfg.starts_at);
          const e = toLocalParts(cfg.ends_at);
          setStartDate(s.date);
          setStartTime(s.time);
          setEndDate(e.date);
          setEndTime(e.time);
        }
      } catch (err) {
        console.error('Erro ao carregar promo:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const starts_at = combineDateTime(startDate, startTime);
      const ends_at = combineDateTime(endDate, endTime);

      if (config.enabled && starts_at && ends_at && new Date(starts_at) >= new Date(ends_at)) {
        toast.error('Data de início deve ser anterior à data de término');
        setSaving(false);
        return;
      }

      const next: ValentinesPromoConfig = {
        enabled: config.enabled,
        label: config.label.trim() || DEFAULT_VALENTINES_CONFIG.label,
        discount_percent: Math.max(1, Math.min(100, Number(config.discount_percent) || 50)),
        starts_at,
        ends_at,
      };

      const { data: existing } = await supabase
        .from('store_config')
        .select('id')
        .eq('key', VALENTINES_CONFIG_KEY)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('store_config')
          .update({ value: next as any, is_public: true, updated_at: new Date().toISOString() })
          .eq('key', VALENTINES_CONFIG_KEY);
      } else {
        await supabase
          .from('store_config')
          .insert({ key: VALENTINES_CONFIG_KEY, value: next as any, is_public: true });
      }

      invalidateValentinesPromo(next);
      setConfig(next);
      toast.success('Promoção Dia dos Namorados atualizada!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar a promoção');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-rose-500" />
          Promoção Dia dos Namorados
        </CardTitle>
        <CardDescription>
          Compre 1 peça e leve a 2ª com desconto (peça de menor ou igual valor). A cada par de itens, o mais barato recebe o desconto. Não combina com cupom nem combo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Label>Ativar promoção</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Liga/desliga a aplicação automática no carrinho e a tarja no topo do site.</p>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(checked) => setConfig((p) => ({ ...p, enabled: checked }))}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nome da promoção</Label>
            <Input
              value={config.label}
              onChange={(e) => setConfig((p) => ({ ...p, label: e.target.value }))}
              placeholder="Dia dos Namorados"
            />
          </div>
          <div className="space-y-2">
            <Label>Desconto na 2ª peça (%)</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={config.discount_percent}
              onChange={(e) => setConfig((p) => ({ ...p, discount_percent: Number(e.target.value) }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Início</Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('flex-1 justify-start text-left font-normal', !startDate && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'dd/MM/yyyy') : 'Data de início'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className={cn('p-3 pointer-events-auto')}
                  />
                </PopoverContent>
              </Popover>
              <div className="relative">
                <Clock className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="pl-8 w-32" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Término</Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('flex-1 justify-start text-left font-normal', !endDate && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'dd/MM/yyyy') : 'Data de término'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    className={cn('p-3 pointer-events-auto')}
                  />
                </PopoverContent>
              </Popover>
              <div className="relative">
                <Clock className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="pl-8 w-32" />
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Deixe início e/ou término em branco para a promoção rodar sem limite de data enquanto estiver ativada.
        </p>

        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar promoção'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ValentinesPromoSettings;
