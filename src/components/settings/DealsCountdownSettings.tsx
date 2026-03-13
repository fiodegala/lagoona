import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Clock, Flame, Save } from 'lucide-react';
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

const DEALS_CONFIG_KEY = 'deals_countdown';

interface DealsConfig {
  enabled: boolean;
  end_date: string | null;
  show_on_home: boolean;
}

const DealsCountdownSettings = () => {
  const [config, setConfig] = useState<DealsConfig>({ enabled: true, end_date: null, show_on_home: true });
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState('23:59');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase
          .from('store_config')
          .select('value')
          .eq('key', DEALS_CONFIG_KEY)
          .maybeSingle();

        if (data?.value) {
          const val = data.value as unknown as DealsConfig;
          setConfig(val);
          if (val.end_date) {
            const d = new Date(val.end_date);
            setDate(d);
            setTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
          }
        }
      } catch (err) {
        console.error('Error loading deals config:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      let endDate: string | null = null;
      if (date) {
        const [h, m] = time.split(':').map(Number);
        const d = new Date(date);
        d.setHours(h, m, 59, 999);
        endDate = d.toISOString();
      }

      const newConfig: DealsConfig = {
        enabled: config.enabled,
        end_date: endDate,
        show_on_home: config.show_on_home,
      };

      const { data: existing } = await supabase
        .from('store_config')
        .select('id')
        .eq('key', DEALS_CONFIG_KEY)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('store_config')
          .update({ value: newConfig as any, is_public: true, updated_at: new Date().toISOString() })
          .eq('key', DEALS_CONFIG_KEY);
      } else {
        await supabase
          .from('store_config')
          .insert({ key: DEALS_CONFIG_KEY, value: newConfig as any, is_public: true });
      }

      toast.success('Configurações de ofertas salvas!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-store-deal" />
          Ofertas com Countdown
        </CardTitle>
        <CardDescription>Configure o timer de contagem regressiva das ofertas na home</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Label>Ativar countdown</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Exibir timer na seção de ofertas</p>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enabled: checked }))}
          />
        </div>

        {config.enabled && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Data de término</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "dd/MM/yyyy") : "Selecione uma data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Hora de término
              </Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full"
              />
            </div>

            {!date && (
              <p className="text-xs text-muted-foreground">
                Sem data configurada, o countdown usa o fim do dia automaticamente.
              </p>
            )}
          </div>
        )}

        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar configurações'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default DealsCountdownSettings;
