import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Bell, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const LowStockAlertSettings = () => {
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('store_config')
        .select('value')
        .eq('key', 'low_stock_alert_phone')
        .maybeSingle();

      if (data?.value && typeof data.value === 'object') {
        setPhone((data.value as any).phone || '');
      }
    } catch (err) {
      console.error('Error loading config:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: existing } = await supabase
        .from('store_config')
        .select('id')
        .eq('key', 'low_stock_alert_phone')
        .maybeSingle();

      const value = { phone: phone.trim() };

      if (existing) {
        await supabase
          .from('store_config')
          .update({ value, updated_at: new Date().toISOString() })
          .eq('key', 'low_stock_alert_phone');
      } else {
        await supabase
          .from('store_config')
          .insert({ key: 'low_stock_alert_phone', value, is_public: false });
      }

      toast.success('Configuração salva com sucesso!');
    } catch (err) {
      console.error('Error saving config:', err);
      toast.error('Erro ao salvar configuração');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="card-elevated">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Alerta de Estoque Baixo
        </CardTitle>
        <CardDescription>
          Receba uma notificação por WhatsApp quando o estoque de um produto ficar abaixo do mínimo configurado.
          O mínimo é definido no campo "Estoque Mínimo" de cada produto.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="alert-phone">Telefone para notificações (com DDD)</Label>
          <Input
            id="alert-phone"
            placeholder="11999999999"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Alertas são enviados no máximo uma vez a cada 6 horas por produto para evitar spam.
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : 'Salvar'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default LowStockAlertSettings;
