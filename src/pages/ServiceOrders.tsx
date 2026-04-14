import { useState, useEffect, useMemo } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { playServiceOrderSound } from '@/lib/alertSounds';
import { Plus, MessageSquare, Clock, CheckCircle2, XCircle, Search, Filter, Settings2, Pencil, Trash2, Users, AlertCircle, X, Image, Video } from 'lucide-react';
import ImageUpload from '@/components/ImageUpload';
import VideoUpload from '@/components/VideoUpload';
import { format } from 'date-fns';

const PRIORITIES = [
  { value: 'low', label: 'Baixa', color: 'bg-muted text-muted-foreground' },
  { value: 'normal', label: 'Normal', color: 'bg-primary/10 text-primary' },
  { value: 'high', label: 'Alta', color: 'bg-orange-100 text-orange-700' },
  { value: 'urgent', label: 'Urgente', color: 'bg-destructive/10 text-destructive' },
];
const STATUSES = [
  { value: 'open', label: 'Aberta', icon: Clock, color: 'bg-blue-100 text-blue-700' },
  { value: 'awaiting_approval', label: 'Aguardando Aprovação', icon: Clock, color: 'bg-yellow-100 text-yellow-700' },
  { value: 'approved', label: 'Aprovada', icon: CheckCircle2, color: 'bg-green-100 text-green-700' },
  { value: 'in_review', label: 'Em Revisão', icon: AlertCircle, color: 'bg-amber-100 text-amber-700' },
  { value: 'in_progress', label: 'Em Andamento', icon: Clock, color: 'bg-purple-100 text-purple-700' },
  { value: 'completed', label: 'Concluída', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700' },
  { value: 'rejected', label: 'Recusada', icon: XCircle, color: 'bg-red-100 text-red-700' },
  { value: 'cancelled', label: 'Cancelada', icon: XCircle, color: 'bg-destructive/10 text-destructive' },
];

// Kanban columns definition
const KANBAN_COLUMNS = [
  { id: 'pending', label: 'Pendentes', statuses: ['open', 'awaiting_approval'], headerColor: 'bg-blue-500', dotColor: 'bg-blue-500' },
  { id: 'in_progress', label: 'Em Andamento', statuses: ['approved', 'in_progress'], headerColor: 'bg-purple-500', dotColor: 'bg-purple-500' },
  { id: 'in_review', label: 'Revisão', statuses: ['in_review'], headerColor: 'bg-amber-500', dotColor: 'bg-amber-500' },
  { id: 'rejected', label: 'Recusadas', statuses: ['rejected'], headerColor: 'bg-red-500', dotColor: 'bg-red-500' },
  { id: 'completed', label: 'Concluídas', statuses: ['completed', 'cancelled'], headerColor: 'bg-emerald-500', dotColor: 'bg-emerald-500' },
];

const ServiceOrders = () => {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [showDeptManager, setShowDeptManager] = useState(false);
  const [filterDept, setFilterDept] = useState('all');
  const [search, setSearch] = useState('');
  const [newComment, setNewComment] = useState('');
  const [form, setForm] = useState({ title: '', description: '', department: '', priority: 'normal', image_url: '' as string | undefined, video_url: '' as string | undefined });
  const [deptForm, setDeptForm] = useState({ name: '', editingId: '' });
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<{ open: boolean; type: 'in_review' | 'rejected' | ''; orderId: string }>({ open: false, type: '', orderId: '' });
  const [actionReason, setActionReason] = useState('');
  const [selectedDeptForManagers, setSelectedDeptForManagers] = useState<string | null>(null);
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);

  // Realtime listener
  useEffect(() => {
    const channel = supabase
      .channel('service-orders-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'service_orders' }, (payload) => {
        const os = payload.new as any;
        if (os.created_by !== user?.id) {
          playServiceOrderSound();
          toast.info('📋 Nova Ordem de Serviço', { description: os.title || 'Nova OS criada' });
        }
        queryClient.invalidateQueries({ queryKey: ['service-orders'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  const { data: departments = [] } = useQuery({
    queryKey: ['service-order-departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_order_departments')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const departmentNames = departments.map((d: any) => d.name as string);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['service-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: deptManagers = [] } = useQuery({
    queryKey: ['department-managers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('department_managers').select('*');
      if (error) throw error;
      return data;
    },
  });

  const profileMap = Object.fromEntries(profiles.map((p: any) => [p.user_id, p.full_name]));
  const selectedOrder = orders.find((o: any) => o.id === showDetail);

  const deptManagerMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    deptManagers.forEach((dm: any) => {
      if (!map[dm.department_id]) map[dm.department_id] = [];
      if (!map[dm.department_id].includes(dm.user_id)) {
        map[dm.department_id].push(dm.user_id);
      }
    });
    return map;
  }, [deptManagers]);

  const getManagerNames = (deptId: string) => {
    const managers = deptManagerMap[deptId] || [];
    const names = managers.map(uid => profileMap[uid]).filter(Boolean);
    return [...new Set(names)];
  };

  const isResponsibleForOrder = (order: any) => {
    if (isAdmin) return true;
    const dept = departments.find((d: any) => d.name === order.department);
    if (!dept) return false;
    const managers = deptManagerMap[dept.id] || [];
    return managers.includes(user?.id || '');
  };

  const { data: comments = [] } = useQuery({
    queryKey: ['service-order-comments', showDetail],
    enabled: !!showDetail,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_order_comments')
        .select('*')
        .eq('service_order_id', showDetail!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('service_orders').insert({
        title: form.title.trim(),
        description: form.description.trim(),
        department: form.department,
        priority: form.priority,
        created_by: user!.id,
        status: 'open',
        image_url: form.image_url || null,
        video_url: form.video_url || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['service-orders'] });
      setShowCreate(false);
      const createdTitle = form.title.trim();
      const createdDept = form.department;
      setForm({ title: '', description: '', department: '', priority: 'normal', image_url: undefined, video_url: undefined });
      toast.success('Ordem de serviço criada!');
      try {
        await supabase.functions.invoke('send-push', {
          body: {
            title: 'Nova Ordem de Serviço',
            message: `${profile?.full_name || 'Usuário'} abriu uma OS: "${createdTitle}" - ${createdDept}`,
            type: 'service_order',
          },
        });
      } catch {}
    },
    onError: () => toast.error('Erro ao criar OS'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason?: string }) => {
      const updates: any = { status };
      if (status === 'approved') {
        updates.approved_by = user!.id;
        updates.approved_at = new Date().toISOString();
        updates.action_type = 'approved';
        updates.actioned_by = user!.id;
        updates.actioned_at = new Date().toISOString();
      }
      if (status === 'in_review' || status === 'rejected') {
        updates.action_type = status === 'in_review' ? 'review' : 'rejected';
        updates.action_reason = reason;
        updates.actioned_by = user!.id;
        updates.actioned_at = new Date().toISOString();
      }
      if (status === 'completed') updates.completed_at = new Date().toISOString();
      const { error } = await supabase.from('service_orders').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-orders'] });
      toast.success('Status atualizado!');
      setActionModal({ open: false, type: '', orderId: '' });
      setActionReason('');
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('service_order_comments').insert({
        service_order_id: showDetail!,
        user_id: user!.id,
        user_name: profile?.full_name || 'Usuário',
        comment: newComment.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-order-comments', showDetail] });
      setNewComment('');
      toast.success('Comentário adicionado!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('service_orders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-orders'] });
      setShowDetail(null);
      toast.success('Ordem de serviço excluída!');
    },
    onError: () => toast.error('Erro ao excluir OS'),
  });

  const saveDeptMutation = useMutation({
    mutationFn: async () => {
      const trimmedName = deptForm.name.trim();
      if (deptForm.editingId) {
        const { error } = await supabase
          .from('service_order_departments')
          .update({ name: trimmedName })
          .eq('id', deptForm.editingId);
        if (error) throw error;
      } else {
        const { data: existing } = await supabase
          .from('service_order_departments')
          .select('id, is_active')
          .eq('name', trimmedName)
          .maybeSingle();
        if (existing && !existing.is_active) {
          const { error } = await supabase
            .from('service_order_departments')
            .update({ is_active: true })
            .eq('id', existing.id);
          if (error) throw error;
        } else if (existing && existing.is_active) {
          throw new Error('Departamento já existe');
        } else {
          const { error } = await supabase
            .from('service_order_departments')
            .insert({ name: trimmedName });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-order-departments'] });
      setDeptForm({ name: '', editingId: '' });
      toast.success(deptForm.editingId ? 'Departamento atualizado!' : 'Departamento criado!');
    },
    onError: (err: any) => {
      console.error('Erro ao salvar departamento:', err);
      toast.error('Erro ao salvar departamento: ' + (err?.message || 'desconhecido'));
    },
  });

  const deleteDeptMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('service_order_departments')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-order-departments'] });
      toast.success('Departamento removido!');
    },
  });

  const toggleManagerMutation = useMutation({
    mutationFn: async ({ deptId, userId, add }: { deptId: string; userId: string; add: boolean }) => {
      if (add) {
        const { error } = await supabase.from('department_managers').insert({ department_id: deptId, user_id: userId });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('department_managers').delete().eq('department_id', deptId).eq('user_id', userId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department-managers'] });
      toast.success('Responsável atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar responsável'),
  });

  // Filter orders by search and department
  const filtered = orders.filter((o: any) => {
    if (filterDept !== 'all' && o.department !== filterDept) return false;
    if (search && !o.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getStatusBadge = (status: string) => {
    const s = STATUSES.find((st) => st.value === status);
    return s ? <Badge className={s.color}>{s.label}</Badge> : <Badge>{status}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const p = PRIORITIES.find((pr) => pr.value === priority);
    return p ? <Badge className={p.color}>{p.label}</Badge> : <Badge>{priority}</Badge>;
  };

  const getNextActions = (current: string) => {
    const actionsWithReason = ['in_review', 'rejected'];
    const flow: Record<string, string[]> = {
      open: ['approved', 'in_review', 'rejected', 'cancelled'],
      awaiting_approval: ['approved', 'in_review', 'rejected', 'cancelled'],
      in_review: ['approved', 'rejected', 'cancelled'],
      approved: ['in_progress', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
    };
    return (flow[current] || []).map(s => ({
      status: s,
      requiresReason: actionsWithReason.includes(s),
    }));
  };

  const handleAction = (orderId: string, status: string, requiresReason: boolean) => {
    if (requiresReason) {
      setActionModal({ open: true, type: status as 'in_review' | 'rejected', orderId });
      setActionReason('');
    } else {
      updateStatusMutation.mutate({ id: orderId, status });
    }
  };

  const confirmAction = () => {
    if (!actionReason.trim()) {
      toast.error('Informe o motivo da ação.');
      return;
    }
    updateStatusMutation.mutate({
      id: actionModal.orderId,
      status: actionModal.type,
      reason: actionReason.trim(),
    });
  };

  // Drag & drop handlers for Kanban
  const handleDragStart = (e: React.DragEvent, orderId: string) => {
    setDraggedOrderId(orderId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    if (!draggedOrderId) return;

    const order = orders.find((o: any) => o.id === draggedOrderId);
    if (!order) return;

    const column = KANBAN_COLUMNS.find(c => c.id === columnId);
    if (!column) return;

    // Already in this column
    if (column.statuses.includes(order.status)) {
      setDraggedOrderId(null);
      return;
    }

    // Map column to target status
    const statusMap: Record<string, string> = {
      pending: 'open',
      in_progress: 'in_progress',
      in_review: 'in_review',
      rejected: 'rejected',
      completed: 'completed',
    };

    const targetStatus = statusMap[columnId];
    if (!targetStatus) return;

    // Check if action requires reason
    if (targetStatus === 'in_review' || targetStatus === 'rejected') {
      setActionModal({ open: true, type: targetStatus as 'in_review' | 'rejected', orderId: draggedOrderId });
      setActionReason('');
    } else {
      updateStatusMutation.mutate({ id: draggedOrderId, status: targetStatus });
    }

    setDraggedOrderId(null);
  };

  // Get orders for a kanban column
  const getColumnOrders = (column: typeof KANBAN_COLUMNS[0]) => {
    return filtered.filter((o: any) => column.statuses.includes(o.status));
  };

  const selectedDeptManagers = selectedDeptForManagers ? (deptManagerMap[selectedDeptForManagers] || []) : [];

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Ordens de Serviço</h1>
            <p className="text-muted-foreground text-sm">Arraste os cards entre colunas para atualizar o status</p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Button variant="outline" onClick={() => setShowDeptManager(true)}>
                <Settings2 className="h-4 w-4 mr-2" /> Departamentos
              </Button>
            )}
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" /> Nova OS
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por título..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="w-[200px]"><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="Departamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              {departmentNames.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Kanban Board */}
        {isLoading ? (
          <p className="text-muted-foreground py-8 text-center">Carregando...</p>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 280px)' }}>
            {KANBAN_COLUMNS.map((column) => {
              const columnOrders = getColumnOrders(column);
              return (
                <div
                  key={column.id}
                  className="flex-shrink-0 w-[280px] flex flex-col rounded-xl bg-muted/30 border"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, column.id)}
                >
                  {/* Column Header */}
                  <div className="flex items-center gap-2 px-3 py-3 border-b">
                    <span className={`w-2.5 h-2.5 rounded-full ${column.dotColor}`} />
                    <h3 className="font-semibold text-sm flex-1">{column.label}</h3>
                    <Badge variant="secondary" className="text-xs font-normal">{columnOrders.length}</Badge>
                  </div>

                  {/* Column Content */}
                  <ScrollArea className="flex-1 p-2">
                    <div className="space-y-2">
                      {columnOrders.length === 0 && (
                        <div className="text-center py-8 text-xs text-muted-foreground">
                          Nenhuma OS
                        </div>
                      )}
                      {columnOrders.map((order: any) => {
                        const dept = departments.find((d: any) => d.name === order.department);
                        const managerNames = dept ? getManagerNames(dept.id) : [];
                        const hasImage = !!order.image_url;
                        const hasVideo = !!order.video_url;

                        return (
                          <Card
                            key={order.id}
                            className={`cursor-pointer hover:shadow-md transition-all group overflow-hidden ${draggedOrderId === order.id ? 'opacity-50' : ''}`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, order.id)}
                            onClick={() => setShowDetail(order.id)}
                          >
                            {/* Compact media preview */}
                            {(hasImage || hasVideo) && (
                              <div className="relative w-full h-28 bg-muted overflow-hidden">
                                {hasImage && (
                                  <img src={order.image_url} alt={order.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                )}
                                {hasVideo && !hasImage && (
                                  <video src={order.video_url} className="w-full h-full object-cover" muted />
                                )}
                                <div className="absolute top-1.5 right-1.5 flex gap-1">
                                  {hasImage && <span className="bg-background/80 backdrop-blur-sm rounded-full p-1"><Image className="h-3 w-3 text-foreground" /></span>}
                                  {hasVideo && <span className="bg-background/80 backdrop-blur-sm rounded-full p-1"><Video className="h-3 w-3 text-foreground" /></span>}
                                </div>
                              </div>
                            )}

                            <CardContent className="p-2.5 space-y-1.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {getPriorityBadge(order.priority)}
                                {getStatusBadge(order.status)}
                              </div>
                              <p className="font-medium text-xs line-clamp-2 leading-tight">{order.title}</p>
                              <div className="text-[11px] text-muted-foreground space-y-0.5">
                                <p className="font-medium">{order.department}</p>
                                <p>{profileMap[order.created_by] || 'Usuário'} • {format(new Date(order.created_at), 'dd/MM HH:mm')}</p>
                                {managerNames.length > 0 && (
                                  <p className="flex items-center gap-1"><Users className="h-2.5 w-2.5" />{managerNames.join(', ')}</p>
                                )}
                              </div>
                              {isAdmin && (
                                <div className="flex justify-end pt-0.5">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-destructive hover:text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm('Tem certeza que deseja excluir esta ordem de serviço?')) {
                                        deleteMutation.mutate(order.id);
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              );
            })}
          </div>
        )}

        {/* Create Dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nova Ordem de Serviço</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Resumo da solicitação" /></div>
              <div><Label>Departamento</Label>
                <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                  <SelectContent>{departmentNames.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descreva a solicitação em detalhes..." rows={4} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Imagem (opcional)</Label>
                  <ImageUpload value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} bucket="product-images" folder="service-orders" />
                </div>
                <div>
                  <Label>Vídeo (opcional)</Label>
                  <VideoUpload value={form.video_url} onChange={(url) => setForm({ ...form, video_url: url })} bucket="product-images" folder="service-orders" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button onClick={() => createMutation.mutate()} disabled={!form.title.trim() || !form.department || !form.description.trim() || createMutation.isPending}>
                {createMutation.isPending ? 'Criando...' : 'Criar OS'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail Dialog */}
        <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            {selectedOrder && (
              <>
                <DialogHeader>
                  <div className="flex items-center justify-between gap-2">
                    <DialogTitle className="flex items-center gap-2">{selectedOrder.title}</DialogTitle>
                    {isAdmin && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => { if (confirm('Tem certeza que deseja excluir esta ordem de serviço?')) deleteMutation.mutate(selectedOrder.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{selectedOrder.department}</Badge>
                    {getPriorityBadge(selectedOrder.priority)}
                    {getStatusBadge(selectedOrder.status)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Criado por <strong>{profileMap[selectedOrder.created_by] || 'Usuário'}</strong> em {format(new Date(selectedOrder.created_at), 'dd/MM/yyyy HH:mm')}
                    {selectedOrder.approved_by && <> • Aprovado por <strong>{profileMap[selectedOrder.approved_by] || 'Admin'}</strong></>}
                  </div>

                  {(selectedOrder as any).action_reason && (
                    <Card className="border-amber-200 bg-amber-50">
                      <CardContent className="p-3 text-sm">
                        <p className="font-semibold text-amber-800">
                          {(selectedOrder as any).action_type === 'review' ? '📝 Motivo da revisão:' : '❌ Motivo da recusa:'}
                        </p>
                        <p className="text-amber-700 mt-1">{(selectedOrder as any).action_reason}</p>
                        <p className="text-xs text-amber-600 mt-1">
                          Por {profileMap[(selectedOrder as any).actioned_by] || 'Responsável'} em {(selectedOrder as any).actioned_at ? format(new Date((selectedOrder as any).actioned_at), 'dd/MM/yyyy HH:mm') : ''}
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {(() => {
                    const dept = departments.find((d: any) => d.name === selectedOrder.department);
                    const managerNames = dept ? getManagerNames(dept.id) : [];
                    if (managerNames.length === 0) return null;
                    return (
                      <div className="text-sm flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Responsáveis:</span>
                        <strong>{managerNames.join(', ')}</strong>
                      </div>
                    );
                  })()}

                  <Card><CardContent className="p-4 whitespace-pre-wrap text-sm">{selectedOrder.description}</CardContent></Card>

                  {((selectedOrder as any).image_url || (selectedOrder as any).video_url) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {(selectedOrder as any).image_url && (
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Imagem anexada</Label>
                          <img src={(selectedOrder as any).image_url} alt="Anexo da OS"
                            className="rounded-lg border w-full max-h-64 object-contain bg-muted cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setLightboxImage((selectedOrder as any).image_url)} />
                        </div>
                      )}
                      {(selectedOrder as any).video_url && (
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Vídeo anexado</Label>
                          <video src={(selectedOrder as any).video_url} controls className="rounded-lg border w-full max-h-64 bg-muted" />
                        </div>
                      )}
                    </div>
                  )}

                  {isResponsibleForOrder(selectedOrder) && getNextActions(selectedOrder.status).length > 0 && (
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-sm font-medium">Ações:</span>
                      {getNextActions(selectedOrder.status).map(({ status, requiresReason }) => {
                        const st = STATUSES.find((x) => x.value === status);
                        const variant = status === 'rejected' ? 'destructive' as const : status === 'approved' ? 'default' as const : 'outline' as const;
                        return (
                          <Button key={status} size="sm" variant={variant}
                            onClick={() => handleAction(selectedOrder.id, status, requiresReason)}>
                            {st?.label || status}
                          </Button>
                        );
                      })}
                    </div>
                  )}

                  <div>
                    <h3 className="font-semibold flex items-center gap-2 mb-3"><MessageSquare className="h-4 w-4" /> Comentários</h3>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {comments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum comentário ainda.</p>
                      ) : (
                        comments.map((c: any) => (
                          <div key={c.id} className="bg-muted/50 rounded-lg p-3 text-sm">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium">{c.user_name || 'Usuário'}</span>
                              <span className="text-xs text-muted-foreground">{format(new Date(c.created_at), 'dd/MM HH:mm')}</span>
                            </div>
                            <p>{c.comment}</p>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Adicionar comentário..."
                        onKeyDown={(e) => e.key === 'Enter' && newComment.trim() && addCommentMutation.mutate()} />
                      <Button size="sm" onClick={() => addCommentMutation.mutate()} disabled={!newComment.trim() || addCommentMutation.isPending}>Enviar</Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Action Reason Modal */}
        <Dialog open={actionModal.open} onOpenChange={(open) => { if (!open) { setActionModal({ open: false, type: '', orderId: '' }); setActionReason(''); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {actionModal.type === 'in_review' ? '📝 Revisar Ordem de Serviço' : '❌ Recusar Ordem de Serviço'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{actionModal.type === 'in_review' ? 'Motivo da revisão *' : 'Motivo da recusa *'}</Label>
                <Textarea value={actionReason} onChange={(e) => setActionReason(e.target.value)}
                  placeholder={actionModal.type === 'in_review' ? 'Descreva o que precisa ser revisado...' : 'Explique o motivo da recusa...'} rows={4} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setActionModal({ open: false, type: '', orderId: '' }); setActionReason(''); }}>Cancelar</Button>
              <Button variant={actionModal.type === 'rejected' ? 'destructive' : 'default'}
                onClick={confirmAction} disabled={!actionReason.trim() || updateStatusMutation.isPending}>
                {updateStatusMutation.isPending ? 'Salvando...' : actionModal.type === 'in_review' ? 'Enviar para Revisão' : 'Recusar OS'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Department Manager Dialog */}
        <Dialog open={showDeptManager} onOpenChange={(open) => { setShowDeptManager(open); if (!open) setSelectedDeptForManagers(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Gerenciar Departamentos</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  placeholder="Nome do departamento" onKeyDown={(e) => e.key === 'Enter' && deptForm.name.trim() && saveDeptMutation.mutate()} />
                <Button onClick={() => saveDeptMutation.mutate()} disabled={!deptForm.name.trim() || saveDeptMutation.isPending}>
                  {deptForm.editingId ? 'Salvar' : 'Adicionar'}
                </Button>
                {deptForm.editingId && <Button variant="ghost" onClick={() => setDeptForm({ name: '', editingId: '' })}>Cancelar</Button>}
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {departments.map((dept: any) => {
                  const managers = deptManagerMap[dept.id] || [];
                  const isSelected = selectedDeptForManagers === dept.id;
                  return (
                    <div key={dept.id} className={`rounded-lg px-3 py-2 ${isSelected ? 'bg-primary/10 border border-primary/30' : 'bg-muted/50'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{dept.name}</span>
                          <Badge variant="outline" className="text-xs">{managers.length} responsável(eis)</Badge>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setSelectedDeptForManagers(isSelected ? null : dept.id)} title="Gerenciar responsáveis">
                            <Users className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDeptForm({ name: dept.name, editingId: dept.id })}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteDeptMutation.mutate(dept.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      {managers.length > 0 && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {managers.map(uid => profileMap[uid]).filter(Boolean).join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })}
                {departments.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum departamento cadastrado.</p>}
              </div>
              {selectedDeptForManagers && (
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Responsáveis: {departments.find((d: any) => d.id === selectedDeptForManagers)?.name}
                  </h4>
                  <p className="text-xs text-muted-foreground">Selecione os usuários responsáveis por este departamento.</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {profiles.map((p: any) => {
                      const isManager = selectedDeptManagers.includes(p.user_id);
                      return (
                        <label key={p.user_id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer">
                          <Checkbox checked={isManager} onCheckedChange={(checked) => {
                            toggleManagerMutation.mutate({ deptId: selectedDeptForManagers, userId: p.user_id, add: !!checked });
                          }} />
                          <span className="text-sm">{p.full_name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {lightboxImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 cursor-pointer" onClick={() => setLightboxImage(null)}>
          <button className="absolute top-4 right-4 text-white hover:text-white/80 transition-colors" onClick={() => setLightboxImage(null)}>
            <X className="h-8 w-8" />
          </button>
          <img src={lightboxImage} alt="Imagem ampliada" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </AdminLayout>
  );
};

export default ServiceOrders;
