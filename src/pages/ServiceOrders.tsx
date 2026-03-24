import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, MessageSquare, Clock, CheckCircle2, XCircle, Search, Filter } from 'lucide-react';
import { format } from 'date-fns';

const DEPARTMENTS = ['Compras', 'TI / Tecnologia', 'Marketing', 'Financeiro / RH'];
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
  { value: 'in_progress', label: 'Em Andamento', icon: Clock, color: 'bg-purple-100 text-purple-700' },
  { value: 'completed', label: 'Concluída', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700' },
  { value: 'cancelled', label: 'Cancelada', icon: XCircle, color: 'bg-destructive/10 text-destructive' },
];

const ServiceOrders = () => {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [filterDept, setFilterDept] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [newComment, setNewComment] = useState('');
  const [form, setForm] = useState({ title: '', description: '', department: '', priority: 'normal' });

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

  const profileMap = Object.fromEntries(profiles.map((p: any) => [p.user_id, p.full_name]));

  const selectedOrder = orders.find((o: any) => o.id === showDetail);

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-orders'] });
      setShowCreate(false);
      setForm({ title: '', description: '', department: '', priority: 'normal' });
      toast.success('Ordem de serviço criada!');
    },
    onError: () => toast.error('Erro ao criar OS'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === 'approved') {
        updates.approved_by = user!.id;
        updates.approved_at = new Date().toISOString();
      }
      if (status === 'completed') updates.completed_at = new Date().toISOString();
      const { error } = await supabase.from('service_orders').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-orders'] });
      toast.success('Status atualizado!');
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

  const filtered = orders.filter((o: any) => {
    if (filterDept !== 'all' && o.department !== filterDept) return false;
    if (filterStatus !== 'all' && o.status !== filterStatus) return false;
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

  const getNextStatuses = (current: string) => {
    const flow: Record<string, string[]> = {
      open: ['awaiting_approval', 'cancelled'],
      awaiting_approval: ['approved', 'cancelled'],
      approved: ['in_progress', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
    };
    return flow[current] || [];
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Ordens de Serviço</h1>
            <p className="text-muted-foreground">Gerencie solicitações entre departamentos</p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nova OS
          </Button>
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
              {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        {isLoading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma ordem de serviço encontrada.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((order: any) => (
              <Card key={order.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowDetail(order.id)}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-1">
                      <p className="font-semibold">{order.title}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{order.department}</span>
                        <span>•</span>
                        <span>{profileMap[order.created_by] || 'Usuário'}</span>
                        <span>•</span>
                        <span>{format(new Date(order.created_at), 'dd/MM/yyyy HH:mm')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getPriorityBadge(order.priority)}
                      {getStatusBadge(order.status)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
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
                  <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
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
                  <DialogTitle className="flex items-center gap-2">
                    {selectedOrder.title}
                  </DialogTitle>
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
                  <Card><CardContent className="p-4 whitespace-pre-wrap text-sm">{selectedOrder.description}</CardContent></Card>

                  {/* Status actions (admin only) */}
                  {isAdmin && getNextStatuses(selectedOrder.status).length > 0 && (
                    <div className="flex gap-2">
                      <span className="text-sm font-medium self-center">Alterar status:</span>
                      {getNextStatuses(selectedOrder.status).map((s) => {
                        const st = STATUSES.find((x) => x.value === s);
                        return (
                          <Button key={s} size="sm" variant="outline" onClick={() => updateStatusMutation.mutate({ id: selectedOrder.id, status: s })}>
                            {st?.label || s}
                          </Button>
                        );
                      })}
                    </div>
                  )}

                  {/* Comments */}
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
      </div>
    </AdminLayout>
  );
};

export default ServiceOrders;
