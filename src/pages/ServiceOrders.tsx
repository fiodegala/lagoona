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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { playServiceOrderSound } from '@/lib/alertSounds';
import { Plus, MessageSquare, Clock, CheckCircle2, XCircle, Search, Filter, Settings2, Pencil, Trash2, Users, AlertCircle, Play } from 'lucide-react';
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

const TAB_FILTERS: Record<string, string[]> = {
  all: [],
  pending: ['open', 'awaiting_approval'],
  in_progress: ['approved', 'in_progress', 'in_review'],
  done: ['completed', 'rejected', 'cancelled'],
};

const ServiceOrders = () => {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [showDeptManager, setShowDeptManager] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [filterDept, setFilterDept] = useState('all');
  const [search, setSearch] = useState('');
  const [newComment, setNewComment] = useState('');
  const [form, setForm] = useState({ title: '', description: '', department: '', priority: 'normal', image_url: '' as string | undefined, video_url: '' as string | undefined });
  const [deptForm, setDeptForm] = useState({ name: '', editingId: '' });
  
  // Action modal state (for review/reject with reason)
  const [actionModal, setActionModal] = useState<{ open: boolean; type: 'in_review' | 'rejected' | ''; orderId: string }>({ open: false, type: '', orderId: '' });
  const [actionReason, setActionReason] = useState('');
  
  // Department manager assignment state
  const [selectedDeptForManagers, setSelectedDeptForManagers] = useState<string | null>(null);

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

  // Fetch department managers
  const { data: deptManagers = [] } = useQuery({
    queryKey: ['department-managers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('department_managers')
        .select('*');
      if (error) throw error;
      return data;
    },
  });

  const profileMap = Object.fromEntries(profiles.map((p: any) => [p.user_id, p.full_name]));
  const selectedOrder = orders.find((o: any) => o.id === showDetail);

  // Build a map: department_id -> user_ids[]
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

  // Helper to get unique manager names for a department
  const getManagerNames = (deptId: string) => {
    const managers = deptManagerMap[deptId] || [];
    const names = managers.map(uid => profileMap[uid]).filter(Boolean);
    return [...new Set(names)]; // deduplicate same name from multiple user_ids
  };

  // Check if current user is a manager of the department of the selected order
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
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['service-orders'] });
      setShowCreate(false);
      const createdTitle = form.title.trim();
      const createdDept = form.department;
      setForm({ title: '', description: '', department: '', priority: 'normal' });
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
      if (deptForm.editingId) {
        const { error } = await supabase
          .from('service_order_departments')
          .update({ name: deptForm.name.trim() })
          .eq('id', deptForm.editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('service_order_departments')
          .insert({ name: deptForm.name.trim() });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-order-departments'] });
      setDeptForm({ name: '', editingId: '' });
      toast.success(deptForm.editingId ? 'Departamento atualizado!' : 'Departamento criado!');
    },
    onError: () => toast.error('Erro ao salvar departamento'),
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

  // Toggle manager for a department
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

  const filtered = orders.filter((o: any) => {
    const tabStatuses = TAB_FILTERS[activeTab];
    if (tabStatuses && tabStatuses.length > 0 && !tabStatuses.includes(o.status)) return false;
    if (filterDept !== 'all' && o.department !== filterDept) return false;
    if (search && !o.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const countByTab = (tab: string) => {
    const statuses = TAB_FILTERS[tab];
    if (!statuses || statuses.length === 0) return orders.length;
    return orders.filter((o: any) => statuses.includes(o.status)).length;
  };

  const getStatusBadge = (status: string) => {
    const s = STATUSES.find((st) => st.value === status);
    return s ? <Badge className={s.color}>{s.label}</Badge> : <Badge>{status}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const p = PRIORITIES.find((pr) => pr.value === priority);
    return p ? <Badge className={p.color}>{p.label}</Badge> : <Badge>{priority}</Badge>;
  };

  const getNextActions = (current: string) => {
    // Actions that require a reason
    const actionsWithReason = ['in_review', 'rejected'];
    // All possible next statuses
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

  const renderOrdersList = () => {
    if (isLoading) return <p className="text-muted-foreground py-8 text-center">Carregando...</p>;
    if (filtered.length === 0) return <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma ordem de serviço encontrada.</CardContent></Card>;
    return (
      <div className="space-y-3">
        {filtered.map((order: any) => {
          const dept = departments.find((d: any) => d.name === order.department);
          const managerNames = dept ? getManagerNames(dept.id) : [];

          return (
            <Card key={order.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowDetail(order.id)}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <p className="font-semibold">{order.title}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                      <span>{order.department}</span>
                      <span>•</span>
                      <span>{profileMap[order.created_by] || 'Usuário'}</span>
                      <span>•</span>
                      <span>{format(new Date(order.created_at), 'dd/MM/yyyy HH:mm')}</span>
                      {managerNames.length > 0 && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{managerNames.join(', ')}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getPriorityBadge(order.priority)}
                    {getStatusBadge(order.status)}
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Tem certeza que deseja excluir esta ordem de serviço?')) {
                            deleteMutation.mutate(order.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const selectedDeptManagers = selectedDeptForManagers ? (deptManagerMap[selectedDeptForManagers] || []) : [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Ordens de Serviço</h1>
            <p className="text-muted-foreground">Gerencie solicitações entre departamentos</p>
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

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">Todas ({countByTab('all')})</TabsTrigger>
            <TabsTrigger value="pending">Pendentes ({countByTab('pending')})</TabsTrigger>
            <TabsTrigger value="in_progress">Em Andamento ({countByTab('in_progress')})</TabsTrigger>
            <TabsTrigger value="done">Concluídas ({countByTab('done')})</TabsTrigger>
          </TabsList>

          <div className="flex flex-col sm:flex-row gap-3 mt-4">
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

          <TabsContent value="all">{renderOrdersList()}</TabsContent>
          <TabsContent value="pending">{renderOrdersList()}</TabsContent>
          <TabsContent value="in_progress">{renderOrdersList()}</TabsContent>
          <TabsContent value="done">{renderOrdersList()}</TabsContent>
        </Tabs>

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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm('Tem certeza que deseja excluir esta ordem de serviço?')) {
                            deleteMutation.mutate(selectedOrder.id);
                          }
                        }}
                      >
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
                    {selectedOrder.approved_by && (
                      <> • Aprovado por <strong>{profileMap[selectedOrder.approved_by] || 'Admin'}</strong></>
                    )}
                  </div>

                  {/* Show action reason if exists */}
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

                  {/* Show responsible users */}
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

                  {/* Actions for responsible users */}
                  {isResponsibleForOrder(selectedOrder) && getNextActions(selectedOrder.status).length > 0 && (
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-sm font-medium">Ações:</span>
                      {getNextActions(selectedOrder.status).map(({ status, requiresReason }) => {
                        const st = STATUSES.find((x) => x.value === status);
                        const variant = status === 'rejected' ? 'destructive' as const : status === 'approved' ? 'default' as const : 'outline' as const;
                        return (
                          <Button 
                            key={status} 
                            size="sm" 
                            variant={variant}
                            onClick={() => handleAction(selectedOrder.id, status, requiresReason)}
                          >
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
                      <Input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Adicionar comentário..." onKeyDown={(e) => e.key === 'Enter' && newComment.trim() && addCommentMutation.mutate()} />
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
                <Textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder={actionModal.type === 'in_review' ? 'Descreva o que precisa ser revisado...' : 'Explique o motivo da recusa...'}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setActionModal({ open: false, type: '', orderId: '' }); setActionReason(''); }}>Cancelar</Button>
              <Button 
                variant={actionModal.type === 'rejected' ? 'destructive' : 'default'}
                onClick={confirmAction} 
                disabled={!actionReason.trim() || updateStatusMutation.isPending}
              >
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
              {/* Add/edit department */}
              <div className="flex gap-2">
                <Input
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  placeholder="Nome do departamento"
                  onKeyDown={(e) => e.key === 'Enter' && deptForm.name.trim() && saveDeptMutation.mutate()}
                />
                <Button onClick={() => saveDeptMutation.mutate()} disabled={!deptForm.name.trim() || saveDeptMutation.isPending}>
                  {deptForm.editingId ? 'Salvar' : 'Adicionar'}
                </Button>
                {deptForm.editingId && (
                  <Button variant="ghost" onClick={() => setDeptForm({ name: '', editingId: '' })}>Cancelar</Button>
                )}
              </div>

              {/* Departments list */}
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

              {/* Manager assignment panel */}
              {selectedDeptForManagers && (
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Responsáveis: {departments.find((d: any) => d.id === selectedDeptForManagers)?.name}
                  </h4>
                  <p className="text-xs text-muted-foreground">Selecione os usuários responsáveis por este departamento. Eles poderão aprovar, revisar ou recusar as OS.</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {profiles.map((p: any) => {
                      const isManager = selectedDeptManagers.includes(p.user_id);
                      return (
                        <label key={p.user_id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer">
                          <Checkbox
                            checked={isManager}
                            onCheckedChange={(checked) => {
                              toggleManagerMutation.mutate({
                                deptId: selectedDeptForManagers,
                                userId: p.user_id,
                                add: !!checked,
                              });
                            }}
                          />
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
    </AdminLayout>
  );
};

export default ServiceOrders;
