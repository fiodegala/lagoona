import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Video, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const CONFIG_KEY = 'wholesale_video';

const WholesaleVideoSettings = () => {
  const [videoUrl, setVideoUrl] = useState('/assets/atacado-fdg.mp4');
  const [autoplay, setAutoplay] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase
          .from('store_config')
          .select('value')
          .eq('key', CONFIG_KEY)
          .maybeSingle();
        if (data?.value) {
          const val = data.value as { url?: string; autoplay?: boolean };
          if (val.url) setVideoUrl(val.url);
          if (typeof val.autoplay === 'boolean') setAutoplay(val.autoplay);
        }
      } catch (err) {
        console.error('Error loading wholesale video config:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const value = { url: videoUrl, autoplay };
      const { data: existing } = await supabase
        .from('store_config')
        .select('id')
        .eq('key', CONFIG_KEY)
        .maybeSingle();

      let error;
      if (existing) {
        const res = await supabase
          .from('store_config')
          .update({ value: value as any, is_public: true, updated_at: new Date().toISOString() })
          .eq('key', CONFIG_KEY);
        error = res.error;
      } else {
        const res = await supabase
          .from('store_config')
          .insert({ key: CONFIG_KEY, value: value as any, is_public: true } as any);
        error = res.error;
      }

      if (error) {
        toast.error('Erro ao salvar: ' + error.message);
        return;
      }
      toast.success('Vídeo do atacado atualizado!');
    } catch (err) {
      console.error(err);
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
          <Video className="h-5 w-5" />
          Vídeo Atacado FDG
        </CardTitle>
        <CardDescription>
          URL do vídeo exibido na seção de Atacado na página inicial
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>URL do vídeo</Label>
          <Input
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://... ou /assets/atacado-fdg.mp4"
          />
          <p className="text-xs text-muted-foreground">
            Cole a URL de um vídeo MP4 ou link externo (YouTube, etc.)
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label>Autoplay (reprodução automática)</Label>
            <p className="text-xs text-muted-foreground">
              O vídeo será reproduzido automaticamente ao carregar a página
            </p>
          </div>
          <Switch checked={autoplay} onCheckedChange={setAutoplay} />
        </div>

        {videoUrl && (
          <video
            src={videoUrl}
            controls
            muted
            autoPlay={autoplay}
            loop={autoplay}
            className="w-full max-w-md aspect-video rounded-lg border object-cover"
          />
        )}

        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
};

export default WholesaleVideoSettings;
