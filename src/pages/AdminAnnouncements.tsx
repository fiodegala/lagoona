import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Plus, Megaphone, Trash2, Edit, Play, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import ImageUpload from '@/components/ImageUpload';
import VideoUpload from '@/components/VideoUpload';

const AdminAnnouncements = () => {
  const { user, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [viewing, setViewing] = useState<any>(null);
  const [form, setForm] = useState({
    title: '', message: '', image_url: '', video_url: '', link_url: '', link_text: '',
    target_type: 'all', target_user_ids: [] as string[], is_active: true, expires_at: '',
  });

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['admin-announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_announcements')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      // Non-admins only see active announcements targeted to them
      if (!isAdmin) {
        const now = new Date();
        return (data || []).filter((a: any) => {
          if (!a.is_active) return false;
          if (a.expires_at && new Date(a.expires_at) < now) return false;
          if (a.target_type === 'specific' && !(a.target_user_ids || []).includes(user!.id)) return false;
          return true;
        });
      }
      return data || [];
    },
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users-for-announcements'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name');
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        title: form.title.trim(), message: form.message.trim(),
        image_url: form.image_url || null, video_url: form.video_url || null,
        link_url: form.link_url || null, link_text: form.link_text || null,
        target_type: form.target_type,
        target_user_ids: form.target_type === 'specific' ? form.target_user_ids : [],
        is_active: form.is_active, expires_at: form.expires_at || null,
      };
      if (editing) {
        const { error } = await supabase.from('admin_announcements').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        payload.created_by = user!.id;
        const { error } = await supabase.from('admin_announcements').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
      closeForm();
      toast.success(editing ? 'Comunicado atualizado!' : 'Comunicado criado!');
    },
    onError: () => toast.error('Erro ao salvar comunicado'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('admin_announcements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
      toast.success('Comunicado excluído!');
    },
  });

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm({ title: '', message: '', image_url: '', video_url: '', link_url: '', link_text: '', target_type: 'all', target_user_ids: [], is_active: true, expires_at: '' });
  };

  const openEdit = (a: any) => {
    setEditing(a);
    setForm({
      title: a.title, message: a.message, image_url: a.image_url || '', video_url: a.video_url || '',
      link_url: a.link_url || '', link_text: a.link_text || '', target_type: a.target_type,
      target_user_ids: a.target_user_ids || [], is_active: a.is_active,
      expires_at: a.expires_at ? a.expires_at.slice(0, 16) : '',
    });
    setShowForm(true);
  };

  const toggleUser = (userId: string) => {
    setForm((prev) => ({
      ...prev,
      target_user_ids: prev.target_user_ids.includes(userId)
        ? prev.target_user_ids.filter((id) => id !== userId)
        : [...prev.target_user_ids, userId],
    }));
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Comunicados</h1>
            <p className="text-muted-foreground">
              {isAdmin ? 'Crie e gerencie comunicados para a equipe' : 'Visualize os comunicados da equipe'}
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => { closeForm(); setShowForm(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Novo Comunicado
            </Button>
          )}
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : announcements.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum comunicado disponível.</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {announcements.map((a: any) => (
              <Card
                key={a.id}
                className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow group"
                onClick={() => setViewing(a)}
              >
                {/* Media preview */}
                {a.video_url ? (
                  <div className="relative aspect-video bg-muted flex items-center justify-center">
                    <video src={a.video_url} className="w-full h-full object-cover" muted preload="metadata" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition-colors">
                      <Play className="h-10 w-10 text-white fill-white" />
                    </div>
                  </div>
                ) : a.image_url ? (
                  <div className="aspect-video bg-muted">
                    <img src={a.image_url} alt={a.title} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="aspect-video bg-muted flex items-center justify-center">
                    <Megaphone className="h-12 w-12 text-muted-foreground/30" />
                  </div>
                )}

                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm line-clamp-1 flex-1">{a.title}</h3>
                    {isAdmin && (
                      a.is_active
                        ? <Badge className="bg-green-100 text-green-700 text-xs">Ativo</Badge>
                        : <Badge variant="secondary" className="text-xs">Inativo</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{a.message}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(a.created_at), 'dd/MM/yyyy')}
                    </span>
                    {isAdmin && (
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(a)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => { if (confirm('Excluir este comunicado?')) deleteMutation.mutate(a.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* View Dialog */}
        <Dialog open={!!viewing} onOpenChange={(open) => { if (!open) setViewing(null); }}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" />
                {viewing?.title}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {viewing?.video_url && (
                <video src={viewing.video_url} controls autoPlay className="w-full rounded-lg" />
              )}
              {viewing?.image_url && (
                <img src={viewing.image_url} alt={viewing?.title} className="w-full rounded-lg object-cover" />
              )}
              <p className="text-sm whitespace-pre-wrap">{viewing?.message}</p>
              <p className="text-xs text-muted-foreground">
                Publicado em {viewing && format(new Date(viewing.created_at), 'dd/MM/yyyy HH:mm')}
              </p>
              {viewing?.link_url && (
                <a href={viewing.link_url} target="_blank" rel="noopener noreferrer">
                  <Button size="sm">{viewing.link_text || 'Saiba mais'}</Button>
                </a>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Create/Edit Dialog - Admin only */}
        {isAdmin && (
          <Dialog open={showForm} onOpenChange={(open) => { if (!open) closeForm(); }}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? 'Editar Comunicado' : 'Novo Comunicado'}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Título do comunicado" /></div>
                <div><Label>Mensagem *</Label><Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Conteúdo do comunicado..." rows={4} /></div>
                <div><Label>Imagem (opcional)</Label><ImageUpload value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url || '' })} bucket="product-images" folder="announcements" /></div>
                <div><Label>Vídeo (opcional)</Label><VideoUpload value={form.video_url || undefined} onChange={(url) => setForm({ ...form, video_url: url || '' })} bucket="product-images" folder="announcements-videos" maxSizeMB={50} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>URL do link (opcional)</Label><Input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="https://..." /></div>
                  <div><Label>Texto do botão</Label><Input value={form.link_text} onChange={(e) => setForm({ ...form, link_text: e.target.value })} placeholder="Saiba mais" /></div>
                </div>
                <div><Label>Expiração (opcional)</Label><Input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} /></div>
                <div><Label>Público-alvo</Label>
                  <Select value={form.target_type} onValueChange={(v) => setForm({ ...form, target_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os usuários</SelectItem>
                      <SelectItem value="specific">Usuários específicos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.target_type === 'specific' && (
                  <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                    {allUsers.map((u: any) => (
                      <label key={u.user_id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={form.target_user_ids.includes(u.user_id)} onCheckedChange={() => toggleUser(u.user_id)} />
                        {u.full_name || 'Sem nome'}
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                  <Label>Ativo</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeForm}>Cancelar</Button>
                <Button onClick={() => saveMutation.mutate()} disabled={!form.title.trim() || !form.message.trim() || saveMutation.isPending}>
                  {saveMutation.isPending ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminAnnouncements;
