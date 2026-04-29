
import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, Search, Trash2, Edit2, X, Eye, Play, Image as ImageIcon, Video, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import MultiImageUpload from '@/components/MultiImageUpload';
import VideoUpload from '@/components/VideoUpload';
import { auditService } from '@/services/auditService';

interface VMPost {
  id: string;
  title: string;
  description: string | null;
  category: string;
  store_id: string | null;
  images: string[];
  videos: string[];
  created_by: string;
  is_active: boolean;
  created_at: string;
}

interface Store {
  id: string;
  name: string;
}

interface Profile {
  user_id: string;
  full_name: string;
}

const VM_CATEGORIES = ['Geral', 'Vitrine', 'Prateleira', 'Provador', 'Caixa', 'Fachada', 'Manequim', 'Araras'];

const VisualMerchandising = () => {
  const { user, isAdmin } = useAuth();
  const [posts, setPosts] = useState<VMPost[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [editors, setEditors] = useState<string[]>([]);
  const [isEditor, setIsEditor] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStore, setFilterStore] = useState('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingPost, setEditingPost] = useState<VMPost | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('Geral');
  const [formStoreId, setFormStoreId] = useState<string>('none');
  const [formImages, setFormImages] = useState<string[]>([]);
  const [formVideos, setFormVideos] = useState<string[]>([]);
  const [formVideoUrl, setFormVideoUrl] = useState('');
  const [saving, setSaving] = useState(false);

  // Lightbox with navigation
  const [lightboxItems, setLightboxItems] = useState<{ url: string; type: 'image' | 'video' }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const lightboxOpen = lightboxItems.length > 0;
  const lightboxCurrent = lightboxItems[lightboxIndex] || null;

  const openLightbox = (post: VMPost, url: string) => {
    const items: { url: string; type: 'image' | 'video' }[] = [
      ...post.images.map(u => ({ url: u, type: 'image' as const })),
      ...post.videos.map(u => ({ url: u, type: 'video' as const })),
    ];
    const idx = items.findIndex(i => i.url === url);
    setLightboxItems(items);
    setLightboxIndex(idx >= 0 ? idx : 0);
  };
  const closeLightbox = () => { setLightboxItems([]); setLightboxIndex(0); };
  const lightboxPrev = () => setLightboxIndex(i => i === 0 ? lightboxItems.length - 1 : i - 1);
  const lightboxNext = () => setLightboxIndex(i => i === lightboxItems.length - 1 ? 0 : i + 1);

  // Active tab
  const [activeTab, setActiveTab] = useState('gallery');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [postsRes, storesRes, profilesRes, editorsRes] = await Promise.all([
        supabase.from('vm_posts').select('*').eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('stores').select('id, name').eq('is_active', true),
        supabase.from('profiles').select('user_id, full_name'),
        supabase.from('vm_editors').select('user_id'),
      ]);

      if (postsRes.data) {
        setPosts(postsRes.data.map(p => ({
          ...p,
          images: Array.isArray(p.images) ? p.images as string[] : [],
          videos: Array.isArray(p.videos) ? p.videos as string[] : [],
        })));
      }
      if (storesRes.data) setStores(storesRes.data);
      if (profilesRes.data) setProfiles(profilesRes.data);
      if (editorsRes.data) {
        const editorIds = editorsRes.data.map(e => e.user_id);
        setEditors(editorIds);
        setIsEditor(isAdmin || (!!user && editorIds.includes(user.id)));
      } else {
        setIsEditor(isAdmin);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingPost(null);
    setFormTitle('');
    setFormDescription('');
    setFormCategory('Geral');
    setFormStoreId('none');
    setFormImages([]);
    setFormVideos([]);
    setFormVideoUrl('');
    setShowModal(true);
  };

  const openEditModal = (post: VMPost) => {
    setEditingPost(post);
    setFormTitle(post.title);
    setFormDescription(post.description || '');
    setFormCategory(post.category || 'Geral');
    setFormStoreId(post.store_id || 'none');
    setFormImages(post.images);
    setFormVideos(post.videos);
    setFormVideoUrl('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim()) {
      toast.error('Informe o título');
      return;
    }
    if (formImages.length === 0 && formVideos.length === 0) {
      toast.error('Adicione pelo menos uma foto ou vídeo');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: formTitle.trim(),
        description: formDescription.trim() || null,
        category: formCategory,
        store_id: formStoreId === 'none' ? null : formStoreId,
        images: formImages,
        videos: formVideos,
        created_by: user!.id,
      };

      if (editingPost) {
        const { error } = await supabase.from('vm_posts').update(payload).eq('id', editingPost.id);
        if (error) throw error;
        toast.success('Publicação atualizada!');
        auditService.log({
          action: 'update',
          entity_type: 'vm_post',
          entity_id: editingPost.id,
          details: { title: payload.title, category: payload.category, store_id: payload.store_id },
        });
      } else {
        const { data: inserted, error } = await supabase.from('vm_posts').insert(payload).select('id').single();
        if (error) throw error;
        toast.success('Publicação criada!');
        auditService.log({
          action: 'create',
          entity_type: 'vm_post',
          entity_id: inserted?.id,
          details: { title: payload.title, category: payload.category, store_id: payload.store_id },
        });
      }

      setShowModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta publicação?')) return;
    const post = posts.find(p => p.id === id);
    const { error } = await supabase.from('vm_posts').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir');
    } else {
      toast.success('Publicação excluída');
      auditService.log({
        action: 'delete',
        entity_type: 'vm_post',
        entity_id: id,
        details: { title: post?.title, category: post?.category },
      });
      loadData();
    }
  };

  const addVideoUrl = () => {
    const url = formVideoUrl.trim();
    if (!url) return;
    setFormVideos(prev => [...prev, url]);
    setFormVideoUrl('');
  };

  const removeVideo = (idx: number) => {
    setFormVideos(prev => prev.filter((_, i) => i !== idx));
  };

  // Editor management
  const toggleEditor = async (userId: string) => {
    const isCurrentEditor = editors.includes(userId);
    if (isCurrentEditor) {
      const { error } = await supabase.from('vm_editors').delete().eq('user_id', userId);
      if (error) { toast.error('Erro ao remover editor'); return; }
      toast.success('Editor removido');
    } else {
      const { error } = await supabase.from('vm_editors').insert({ user_id: userId });
      if (error) { toast.error('Erro ao adicionar editor'); return; }
      toast.success('Editor adicionado');
    }
    loadData();
  };

  const filteredPosts = posts.filter(p => {
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCategory !== 'all' && p.category !== filterCategory) return false;
    if (filterStore !== 'all' && p.store_id !== filterStore) return false;
    if (filterStartDate || filterEndDate) {
      const createdAt = new Date(p.created_at).getTime();
      if (filterStartDate) {
        const start = new Date(`${filterStartDate}T00:00:00`).getTime();
        if (createdAt < start) return false;
      }
      if (filterEndDate) {
        const end = new Date(`${filterEndDate}T23:59:59.999`).getTime();
        if (createdAt > end) return false;
      }
    }
    return true;
  });

  const getStoreName = (storeId: string | null) => {
    if (!storeId) return 'Todas as lojas';
    return stores.find(s => s.id === storeId)?.name || 'Loja';
  };

  const getProfileName = (userId: string) => {
    return profiles.find(p => p.user_id === userId)?.full_name || 'Usuário';
  };

  const formatVMDate = (date: string) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Visual de Loja</h1>
          <p className="text-muted-foreground">Padrões visuais e organização das lojas</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="gallery">
            <Eye className="h-4 w-4 mr-1" />
            Galeria
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="editors">Editores</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="gallery" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {VM_CATEGORIES.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStore} onValueChange={setFilterStore}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Loja" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas lojas</SelectItem>
                {stores.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isEditor && (
              <Button onClick={openCreateModal}>
                <Plus className="h-4 w-4 mr-1" />
                Nova Publicação
              </Button>
            )}
          </div>

          {/* Grid */}
          {filteredPosts.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>Nenhuma publicação encontrada</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPosts.map(post => (
                <Card key={post.id} className="overflow-hidden">
                  {/* First media as cover */}
                  {post.images.length > 0 ? (
                    <div
                      className="aspect-video bg-muted cursor-pointer relative group"
                      onClick={() => openLightbox(post, post.images[0])}
                    >
                      <img src={post.images[0]} alt={post.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <Eye className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ) : post.videos.length > 0 ? (
                    <div
                      className="aspect-video bg-muted cursor-pointer relative group"
                      onClick={() => openLightbox(post, post.videos[0])}
                    >
                      <video src={post.videos[0]} muted className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <Play className="h-10 w-10 text-white" />
                      </div>
                    </div>
                  ) : null}

                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold line-clamp-1">{post.title}</h3>
                      <Badge variant="secondary" className="shrink-0">{post.category}</Badge>
                    </div>
                    {post.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{post.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{getStoreName(post.store_id)}</span>
                      <span>•</span>
                      <CalendarDays className="h-3 w-3" />
                      <span>{formatVMDate(post.created_at)}</span>
                      <span>•</span>
                      <span>{post.images.length} fotos</span>
                      {post.videos.length > 0 && <><span>•</span><span>{post.videos.length} vídeos</span></>}
                    </div>

                    {/* Thumbnails */}
                    {(post.images.length > 1 || post.videos.length > 0) && (
                      <div className="flex gap-1 overflow-x-auto pt-1">
                        {post.images.map((img, i) => (
                          <img
                            key={i}
                            src={img}
                            alt=""
                            className="h-12 w-12 rounded object-cover cursor-pointer border hover:ring-2 ring-primary shrink-0"
                            onClick={() => openLightbox(post, img)}
                          />
                        ))}
                        {post.videos.map((vid, i) => (
                          <div
                            key={`v-${i}`}
                            className="h-12 w-12 rounded bg-muted flex items-center justify-center cursor-pointer border hover:ring-2 ring-primary shrink-0"
                            onClick={() => openLightbox(post, vid)}
                          >
                            <Play className="h-5 w-5 text-muted-foreground" />
                          </div>
                        ))}
                      </div>
                    )}

                    {isEditor && (
                      <div className="flex gap-2 pt-2 border-t">
                        <Button size="sm" variant="outline" onClick={() => openEditModal(post)}>
                          <Edit2 className="h-3 w-3 mr-1" /> Editar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(post.id)}>
                          <Trash2 className="h-3 w-3 mr-1" /> Excluir
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="editors" className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="font-semibold">Gerenciar Editores VM</h3>
                <p className="text-sm text-muted-foreground">Selecione quais usuários podem criar e editar publicações do Visual de Loja.</p>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {profiles.map(p => {
                    const isEd = editors.includes(p.user_id);
                    return (
                      <div key={p.user_id} className="flex items-center justify-between p-2 rounded border">
                        <span className="text-sm">{p.full_name}</span>
                        <Button
                          size="sm"
                          variant={isEd ? 'destructive' : 'outline'}
                          onClick={() => toggleEditor(p.user_id)}
                        >
                          {isEd ? 'Remover' : 'Adicionar'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPost ? 'Editar Publicação' : 'Nova Publicação'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Ex: Layout Vitrine Verão 2026" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Instruções e observações..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoria</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VM_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Loja (opcional)</Label>
                <Select value={formStoreId} onValueChange={setFormStoreId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Todas as lojas</SelectItem>
                    {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Images */}
            <div>
              <Label className="flex items-center gap-1 mb-2"><ImageIcon className="h-4 w-4" /> Fotos</Label>
              <MultiImageUpload
                values={formImages}
                onChange={setFormImages}
                bucket="vm-media"
                folder="images"
                maxImages={20}
              />
            </div>

            {/* Videos */}
            <div className="space-y-3">
              <Label className="flex items-center gap-1"><Video className="h-4 w-4" /> Vídeos</Label>
              <VideoUpload
                value={undefined}
                onChange={(url) => { if (url) setFormVideos(prev => [...prev, url]); }}
                bucket="vm-media"
                folder="videos"
                maxSizeMB={50}
              />
              <div className="flex gap-2">
                <Input
                  placeholder="Ou cole um link (YouTube, Instagram...)"
                  value={formVideoUrl}
                  onChange={e => setFormVideoUrl(e.target.value)}
                />
                <Button type="button" variant="outline" onClick={addVideoUrl} disabled={!formVideoUrl.trim()}>
                  Adicionar
                </Button>
              </div>
              {formVideos.length > 0 && (
                <div className="space-y-2">
                  {formVideos.map((v, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm bg-muted p-2 rounded">
                      <Play className="h-4 w-4 shrink-0" />
                      <span className="truncate flex-1">{v}</span>
                      <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeVideo(i)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : editingPost ? 'Atualizar' : 'Publicar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox with navigation */}
      <Dialog open={lightboxOpen} onOpenChange={() => closeLightbox()}>
        <DialogContent className="max-w-4xl p-2 bg-black/95 border-none">
          <div className="relative flex items-center justify-center min-h-[50vh]">
            {/* Close */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-50 text-white hover:bg-white/20"
              onClick={closeLightbox}
            >
              <X className="h-6 w-6" />
            </Button>

            {/* Previous */}
            {lightboxItems.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 h-12 w-12"
                onClick={lightboxPrev}
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
            )}

            {/* Content */}
            {lightboxCurrent?.type === 'image' && (
              <img src={lightboxCurrent.url} alt="VM" className="w-full h-auto max-h-[80vh] object-contain rounded" />
            )}
            {lightboxCurrent?.type === 'video' && (
              lightboxCurrent.url.includes('youtube') || lightboxCurrent.url.includes('youtu.be') ? (
                <iframe
                  src={lightboxCurrent.url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                  className="w-full aspect-video rounded"
                  allowFullScreen
                />
              ) : (
                <video src={lightboxCurrent.url} controls autoPlay className="w-full max-h-[80vh] rounded" />
              )
            )}

            {/* Next */}
            {lightboxItems.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 h-12 w-12"
                onClick={lightboxNext}
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            )}

            {/* Counter */}
            {lightboxItems.length > 1 && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white/80 text-sm font-medium bg-black/50 px-3 py-1 rounded-full">
                {lightboxIndex + 1} / {lightboxItems.length}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </AdminLayout>
  );
};

export default VisualMerchandising;
