import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, GripVertical, Eye, EyeOff, Loader2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import AdminLayout from '@/components/AdminLayout';
import ImageUpload from '@/components/ImageUpload';
import VideoUpload from '@/components/VideoUpload';
import { bannersService, Banner, CreateBannerData } from '@/services/banners';

const bannerTypes = [
  { value: 'hero', label: 'Hero (Principal)' },
  { value: 'mid', label: 'Rotativo (Entre Seções)' },
  { value: 'promo', label: 'Promocional' },
  { value: 'category', label: 'Categoria' },
  { value: 'launches', label: 'Lançamentos' },
];

const Banners = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [activeTab, setActiveTab] = useState('hero');
  const [formData, setFormData] = useState<CreateBannerData>({
    type: 'hero',
    title: '',
    subtitle: '',
    image_url: '',
    link_url: '',
    sort_order: 0,
    is_active: true,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    setIsLoading(true);
    try {
      const data = await bannersService.getAll();
      setBanners(data);
    } catch (error) {
      console.error('Error loading banners:', error);
      toast.error('Erro ao carregar banners');
    } finally {
      setIsLoading(false);
    }
  };

  const openModal = (banner?: Banner) => {
    if (banner) {
      setEditingBanner(banner);
      setFormData({
        type: banner.type,
        title: banner.title || '',
        subtitle: banner.subtitle || '',
        image_url: banner.image_url,
        link_url: banner.link_url || '',
        sort_order: banner.sort_order,
        is_active: banner.is_active,
      });
    } else {
      setEditingBanner(null);
      const filteredBanners = banners.filter(b => b.type === activeTab);
      setFormData({
        type: activeTab,
        title: '',
        subtitle: '',
        image_url: '',
        link_url: '',
        sort_order: filteredBanners.length,
        is_active: true,
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.image_url) {
      toast.error('Selecione uma imagem');
      return;
    }
    setIsSaving(true);
    try {
      if (editingBanner) {
        await bannersService.update(editingBanner.id, formData);
        toast.success('Banner atualizado!');
      } else {
        await bannersService.create(formData);
        toast.success('Banner criado!');
      }
      setModalOpen(false);
      loadBanners();
    } catch {
      toast.error('Erro ao salvar banner');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este banner?')) return;
    try {
      await bannersService.delete(id);
      toast.success('Banner excluído');
      loadBanners();
    } catch {
      toast.error('Erro ao excluir banner');
    }
  };

  const handleToggleActive = async (banner: Banner) => {
    try {
      await bannersService.update(banner.id, { is_active: !banner.is_active });
      loadBanners();
    } catch {
      toast.error('Erro ao atualizar banner');
    }
  };

  const filteredBanners = banners.filter(b => b.type === activeTab);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Banners</h1>
            <p className="text-muted-foreground">Gerencie os banners exibidos na loja</p>
          </div>
          <Button onClick={() => openModal()} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Banner
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            {bannerTypes.map(t => (
              <TabsTrigger key={t.value} value={t.value} className="gap-2">
                {t.label}
                <Badge variant="secondary" className="ml-1 text-xs">
                  {banners.filter(b => b.type === t.value).length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {bannerTypes.map(t => (
            <TabsContent key={t.value} value={t.value}>
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredBanners.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum banner {t.label.toLowerCase()} cadastrado.</p>
                  <Button variant="outline" onClick={() => openModal()} className="mt-4 gap-2">
                    <Plus className="h-4 w-4" />
                    Adicionar banner
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredBanners.map((banner) => (
                    <Card key={banner.id} className={!banner.is_active ? 'opacity-60' : ''}>
                      <div className="relative aspect-[16/9] overflow-hidden rounded-t-lg bg-muted">
                        <img
                          src={banner.image_url}
                          alt={banner.title || 'Banner'}
                          className="w-full h-full object-cover"
                        />
                        {!banner.is_active && (
                          <div className="absolute top-2 left-2">
                            <Badge variant="secondary">Inativo</Badge>
                          </div>
                        )}
                        <div className="absolute top-2 right-2">
                          <Badge variant="outline" className="bg-background/80 text-xs">
                            #{banner.sort_order + 1}
                          </Badge>
                        </div>
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-sm line-clamp-1">{banner.title || 'Sem título'}</h3>
                        {banner.subtitle && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{banner.subtitle}</p>
                        )}
                        {banner.link_url && (
                          <p className="text-xs text-primary truncate mt-1">{banner.link_url}</p>
                        )}
                        <div className="flex items-center gap-2 mt-3">
                          <Button variant="outline" size="sm" onClick={() => openModal(banner)} className="gap-1">
                            <Pencil className="h-3 w-3" />
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(banner)}
                            className="gap-1"
                          >
                            {banner.is_active ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            {banner.is_active ? 'Desativar' : 'Ativar'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(banner.id)}
                            className="text-destructive hover:text-destructive ml-auto"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Banner Form Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingBanner ? 'Editar Banner' : 'Novo Banner'}</DialogTitle>
              <DialogDescription>
                {editingBanner ? 'Atualize as informações do banner' : 'Preencha os dados do novo banner'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Imagem *</Label>
                <ImageUpload
                  value={formData.image_url}
                  onChange={(url) => setFormData(prev => ({ ...prev, image_url: url || '' }))}
                  bucket="product-images"
                  folder="banners"
                />
                <p className="text-xs text-muted-foreground">Recomendado: 1920x600px para banners hero</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, type: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {bannerTypes.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ordem</Label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.sort_order}
                    onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Título</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Título do banner"
                />
              </div>

              <div className="space-y-2">
                <Label>Subtítulo</Label>
                <Input
                  value={formData.subtitle}
                  onChange={(e) => setFormData(prev => ({ ...prev, subtitle: e.target.value }))}
                  placeholder="Texto complementar"
                />
              </div>

              <div className="space-y-2">
                <Label>Link de destino</Label>
                <Input
                  value={formData.link_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, link_url: e.target.value }))}
                  placeholder="/loja ou https://..."
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Ativo</Label>
                  <p className="text-xs text-muted-foreground">Banners inativos não aparecem na loja</p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={isSaving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingBanner ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default Banners;
