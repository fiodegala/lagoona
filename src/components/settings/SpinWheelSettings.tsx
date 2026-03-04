import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const SpinWheelSettings = () => {
  const [enabled, setEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data } = await supabase
        .from('store_config')
        .select('value')
        .eq('key', 'spin_wheel_enabled')
        .maybeSingle();

      if (data?.value !== undefined && data?.value !== null) {
        setEnabled(data.value as boolean);
      }
    } catch (err) {
      console.error('Error loading spin wheel config:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (checked: boolean) => {
    setEnabled(checked);
    try {
      const { data: existing } = await supabase
        .from('store_config')
        .select('id')
        .eq('key', 'spin_wheel_enabled')
        .maybeSingle();

      if (existing) {
        await supabase
          .from('store_config')
          .update({ value: checked as unknown as import('@/integrations/supabase/types').Json, updated_at: new Date().toISOString() })
          .eq('key', 'spin_wheel_enabled');
      } else {
        await supabase
          .from('store_config')
          .insert({ key: 'spin_wheel_enabled', value: checked as unknown as import('@/integrations/supabase/types').Json, is_public: true });
      }

      toast.success(checked ? 'Roleta ativada!' : 'Roleta desativada!');
    } catch (err) {
      console.error('Error saving spin wheel config:', err);
      toast.error('Erro ao salvar configuração');
      setEnabled(!checked);
    }
  };

  if (isLoading) {
    return (
      <Card className="card-elevated">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🎰 Roleta de Cupons
        </CardTitle>
        <CardDescription>
          Ative ou desative a roleta de prêmios exibida na loja
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <Label htmlFor="spin-wheel-toggle" className="text-sm font-medium">
            Exibir roleta na loja
          </Label>
          <Switch
            id="spin-wheel-toggle"
            checked={enabled}
            onCheckedChange={handleToggle}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Quando ativada, a roleta aparece para visitantes que ainda não giraram. Os cupons participantes são controlados pelo campo "Mostrar na roleta" em cada cupom.
        </p>
      </CardContent>
    </Card>
  );
};

export default SpinWheelSettings;
