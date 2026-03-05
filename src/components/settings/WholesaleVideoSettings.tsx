import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Video, Loader2, Check, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const CONFIG_KEY = 'wholesale_video';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const WholesaleVideoSettings = () => {
  const [videoUrl, setVideoUrl] = useState('/assets/atacado-fdg.mp4');
  const [autoplay, setAutoplay] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      toast.error('Selecione um arquivo de vídeo válido');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('O vídeo deve ter no máximo 50MB');
      return;
    }

    setIsUploading(true);
    setUploadProgress('Enviando vídeo...');
    try {
      const ext = file.name.split('.').pop();
      const filePath = `wholesale/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(filePath);
      setVideoUrl(publicUrl);
      setUploadProgress('');
      toast.success('Vídeo enviado! Clique em Salvar para aplicar.');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar vídeo');
      setUploadProgress('');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="upload" className="flex-1 gap-2">
              <Upload className="h-4 w-4" /> Upload do computador
            </TabsTrigger>
            <TabsTrigger value="url" className="flex-1 gap-2">
              <Video className="h-4 w-4" /> URL externa
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-3 mt-3">
            <div className="space-y-2">
              <Label>Selecionar vídeo</Label>
              <div
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
              >
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">{uploadProgress}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium">Clique para selecionar um vídeo</p>
                    <p className="text-xs text-muted-foreground">MP4, WebM, MOV — máx. 50MB</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          </TabsContent>

          <TabsContent value="url" className="space-y-3 mt-3">
            <div className="space-y-2">
              <Label>URL do vídeo</Label>
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://... ou /assets/atacado-fdg.mp4"
              />
              <p className="text-xs text-muted-foreground">
                Cole a URL de um vídeo MP4 ou link externo
              </p>
            </div>
          </TabsContent>
        </Tabs>

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
