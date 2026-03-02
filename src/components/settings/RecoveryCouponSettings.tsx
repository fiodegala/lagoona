import { useState, useEffect } from 'react';
import type { Json } from '@/integrations/supabase/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Gift, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RecoveryCouponConfig {
  enabled: boolean;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  expiration_hours: number;
  prefix: string;
}

const DEFAULT_CONFIG: RecoveryCouponConfig = {
  enabled: true,
  discount_type: 'percentage',
  discount_value: 10,
  expiration_hours: 48,
  prefix: 'VOLTA',
};

const RecoveryCouponSettings = () => {
  const [config, setConfig] = useState<RecoveryCouponConfig>(DEFAULT_CONFIG);
  const [savedConfig, setSavedConfig] = useState<RecoveryCouponConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data } = await supabase
        .from('store_config')
        .select('value')
        .eq('key', 'recovery_coupon_config')
        .maybeSingle();

      if (data?.value && typeof data.value === 'object') {
        const loaded = { ...DEFAULT_CONFIG, ...(data.value as Record<string, unknown>) } as RecoveryCouponConfig;
        setConfig(loaded);
        setSavedConfig(loaded);
      }
    } catch (error) {
      console.error('Error loading recovery coupon config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (config.discount_value <= 0) {
      toast.error('O valor do desconto deve ser maior que zero');
      return;
    }
    if (config.discount_type === 'percentage' && config.discount_value > 100) {
      toast.error('O desconto percentual não pode ser maior que 100%');
      return;
    }
    if (config.expiration_hours < 1) {
      toast.error('A validade deve ser de pelo menos 1 hora');
      return;
    }
    if (!config.prefix.trim()) {
      toast.error('O prefixo do cupom não pode estar vazio');
      return;
    }

    setIsSaving(true);
    try {
      const { data: existing } = await supabase
        .from('store_config')
        .select('id')
        .eq('key', 'recovery_coupon_config')
        .maybeSingle();

      const value = config as unknown as Json;

      if (existing) {
        await supabase
          .from('store_config')
          .update({ value })
          .eq('key', 'recovery_coupon_config');
      } else {
        await supabase
          .from('store_config')
          .insert([{ key: 'recovery_coupon_config', value, is_public: false }]);
      }

      setSavedConfig(config);
      toast.success('Configuração de cupom de recuperação salva!');
    } catch (error) {
      console.error('Error saving recovery coupon config:', error);
      toast.error('Erro ao salvar configuração');
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = JSON.stringify(config) !== JSON.stringify(savedConfig);

  if (isLoading) return null;

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          Cupom de Recuperação de Carrinho
        </CardTitle>
        <CardDescription>
          Configure o cupom de desconto enviado automaticamente para clientes que abandonam o carrinho
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Cupom ativo</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Gerar e enviar cupom automaticamente na notificação de carrinho abandonado
            </p>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enabled: checked }))}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo de desconto</Label>
            <Select
              value={config.discount_type}
              onValueChange={(v) => setConfig(prev => ({ ...prev, discount_type: v as 'percentage' | 'fixed' }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>
              Valor do desconto {config.discount_type === 'percentage' ? '(%)' : '(R$)'}
            </Label>
            <Input
              type="number"
              min={1}
              max={config.discount_type === 'percentage' ? 100 : undefined}
              step={config.discount_type === 'percentage' ? 1 : 0.01}
              value={config.discount_value}
              onChange={(e) => setConfig(prev => ({ ...prev, discount_value: Number(e.target.value) }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Validade do cupom (horas)</Label>
            <Input
              type="number"
              min={1}
              max={720}
              value={config.expiration_hours}
              onChange={(e) => setConfig(prev => ({ ...prev, expiration_hours: Number(e.target.value) }))}
            />
            <p className="text-xs text-muted-foreground">
              {config.expiration_hours >= 24
                ? `${Math.floor(config.expiration_hours / 24)} dia(s) e ${config.expiration_hours % 24}h`
                : `${config.expiration_hours} hora(s)`}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Prefixo do cupom</Label>
            <Input
              value={config.prefix}
              onChange={(e) => setConfig(prev => ({ ...prev, prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) }))}
              maxLength={10}
              placeholder="VOLTA"
            />
            <p className="text-xs text-muted-foreground">
              Exemplo: {config.prefix || 'VOLTA'}{config.discount_value}-XXXXX
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Salvando...' : 'Salvar configuração'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default RecoveryCouponSettings;
