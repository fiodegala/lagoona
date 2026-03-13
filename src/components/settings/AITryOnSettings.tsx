import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const AITryOnSettings = () => {
  const [enabled, setEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('store_config')
        .select('value')
        .eq('key', 'ai_tryon_enabled')
        .maybeSingle();
      if (data?.value !== undefined) {
        setEnabled((data.value as any) === true || data.value === 'true');
      } else {
        setEnabled(true); // default enabled
      }
      setIsLoading(false);
    };
    load();
  }, []);

  const handleToggle = async (value: boolean) => {
    setEnabled(value);
    const { error } = await supabase
      .from('store_config')
      .upsert({ key: 'ai_tryon_enabled', value: value as any, is_public: true, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) {
      toast.error('Erro ao salvar configuração');
      setEnabled(!value);
    } else {
      toast.success(value ? 'Provador com IA ativado' : 'Provador com IA desativado');
    }
  };

  if (isLoading) return null;

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Provador com IA
        </CardTitle>
        <CardDescription>
          Habilite ou desabilite o recurso de provador virtual com IA na página de produto
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <Label htmlFor="ai-tryon-toggle" className="cursor-pointer">
            Exibir botão "Provador com IA" nos produtos
          </Label>
          <Switch
            id="ai-tryon-toggle"
            checked={enabled}
            onCheckedChange={handleToggle}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default AITryOnSettings;
