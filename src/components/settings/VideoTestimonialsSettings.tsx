import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Video, Plus, Trash2, Loader2, GripVertical, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VideoTestimonial {
  id: string;
  title: string;
  video_url: string;
  customer_name: string;
  is_active: boolean;
  sort_order: number;
}

const VideoTestimonialsSettings = () => {
  const [testimonials, setTestimonials] = useState<VideoTestimonial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // New testimonial form
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadTestimonials = async () => {
    try {
      const { data, error } = await supabase
        .from('video_testimonials')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setTestimonials((data || []) as VideoTestimonial[]);
    } catch (err) {
      console.error('Error loading testimonials:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTestimonials();
  }, []);

  const handleAdd = async (videoUrl?: string) => {
    const url = videoUrl || newVideoUrl.trim();
    if (!url) {
      toast.error('Informe a URL do vídeo');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from('video_testimonials').insert({
        video_url: url,
        title: newTitle.trim(),
        customer_name: newCustomerName.trim(),
        sort_order: testimonials.length,
        is_active: true,
      } as any);

      if (error) throw error;

      toast.success('Depoimento adicionado!');
      setNewVideoUrl('');
      setNewTitle('');
      setNewCustomerName('');
      await loadTestimonials();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao adicionar: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      toast.error('Selecione um arquivo de vídeo válido');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      toast.error('O vídeo deve ter no máximo 100MB');
      return;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('testimonial-videos')
        .upload(fileName, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('testimonial-videos')
        .getPublicUrl(fileName);

      await handleAdd(urlData.publicUrl);
      toast.success('Vídeo enviado com sucesso!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao enviar vídeo: ' + err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('video_testimonials')
        .update({ is_active: isActive } as any)
        .eq('id', id);

      if (error) throw error;
      setTestimonials(prev => prev.map(t => t.id === id ? { ...t, is_active: isActive } : t));
    } catch (err: any) {
      toast.error('Erro ao atualizar: ' + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este depoimento?')) return;

    try {
      const { error } = await supabase
        .from('video_testimonials')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setTestimonials(prev => prev.filter(t => t.id !== id));
      toast.success('Depoimento removido');
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + err.message);
    }
  };

  const moveItem = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= testimonials.length) return;

    const updated = [...testimonials];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    updated.forEach((t, i) => (t.sort_order = i));
    setTestimonials(updated);

    // Save order
    try {
      await Promise.all(
        updated.map((t) =>
          supabase.from('video_testimonials').update({ sort_order: t.sort_order } as any).eq('id', t.id)
        )
      );
    } catch (err) {
      console.error('Error saving order:', err);
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
          Depoimentos em Vídeo
        </CardTitle>
        <CardDescription>
          Gerencie os vídeos de depoimentos exibidos na página inicial. Use URLs do YouTube, Instagram, links diretos (.mp4) ou envie seu próprio vídeo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add new */}
        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
          <h4 className="font-medium text-sm">Adicionar novo depoimento</h4>
          
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Título</Label>
              <Input
                placeholder="Ex: Amei o produto!"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nome do cliente</Label>
              <Input
                placeholder="Ex: Maria Silva"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
              />
            </div>
          </div>

          <Tabs defaultValue="url" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="url" className="text-xs">URL externa</TabsTrigger>
              <TabsTrigger value="upload" className="text-xs">Enviar vídeo</TabsTrigger>
            </TabsList>
            <TabsContent value="url" className="space-y-3 mt-3">
              <div className="space-y-1">
                <Label className="text-xs">URL do vídeo *</Label>
                <Input
                  placeholder="https://youtube.com/shorts/..."
                  value={newVideoUrl}
                  onChange={(e) => setNewVideoUrl(e.target.value)}
                />
              </div>
              <Button onClick={() => handleAdd()} disabled={isSaving} size="sm" className="gap-2">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Adicionar
              </Button>
            </TabsContent>
            <TabsContent value="upload" className="space-y-3 mt-3">
              <div className="space-y-1">
                <Label className="text-xs">Arquivo de vídeo (máx 100MB)</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 w-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {isUploading ? 'Enviando...' : 'Selecionar vídeo'}
                </Button>
                <p className="text-xs text-muted-foreground">Formatos: MP4, WebM, MOV. Recomendado: 9:16 (vertical).</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* List */}
        {testimonials.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum depoimento cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {testimonials.map((t, index) => (
              <div key={t.id} className="flex items-center gap-3 border rounded-lg p-3">
                <div className="flex flex-col gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveItem(index, 'up')} disabled={index === 0}>
                    <GripVertical className="h-3 w-3 rotate-0" />
                  </Button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.title || t.video_url}</p>
                  {t.customer_name && <p className="text-xs text-muted-foreground">{t.customer_name}</p>}
                </div>
                <Switch checked={t.is_active} onCheckedChange={(v) => handleToggle(t.id, v)} />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(t.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VideoTestimonialsSettings;
