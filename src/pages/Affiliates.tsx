import { useState, useEffect } from 'react';
import { Users, Check, X, Eye, Loader2, Pencil, Trash2, KeyRound } from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  pending: 'outline',
  blocked: 'destructive',
};
const statusLabels: Record<string, string> = {
  active: 'Ativo',
  pending: 'Pendente',
  blocked: 'Bloqueado',
};

const Affiliates = () => {
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Detail modal
  const [selectedAffiliate, setSelectedAffiliate] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', document: '', commission_percent: '', pix_key: '', referral_code: '', notes: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Password reset
  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  // Delete confirmation
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState('');

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: affs }, { data: sl }, { data: wd }] = await Promise.all([
      supabase.from('affiliates').select('*').order('created_at', { ascending: false }),
      supabase.from('affiliate_sales').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('affiliate_withdrawals').select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    setAffiliates(affs || []);
    setSales(sl || []);
    setWithdrawals(wd || []);
    setLoading(false);
  };

  const updateAffiliateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('affiliates').update({ status }).eq('id', id);
    if (error) { toast.error('Erro ao atualizar status.'); return; }
    toast.success(`Afiliado ${statusLabels[status] || status}.`);
    loadAll();
  };

  const updateCommission = async (id: string, val: string) => {
    const num = parseFloat(val);
    if (isNaN(num) || num < 0 || num > 100) return;
    await supabase.from('affiliates').update({ commission_percent: num }).eq('id', id);
    toast.success('Comissão atualizada.');
    loadAll();
  };

  const updateSaleStatus = async (saleId: string, status: string) => {
    await supabase.from('affiliate_sales').update({ status }).eq('id', saleId);
    toast.success('Status da comissão atualizado.');
    loadAll();
  };

  const processWithdrawal = async (wId: string, status: string) => {
    await supabase.from('affiliate_withdrawals').update({ status, processed_at: status === 'paid' ? new Date().toISOString() : null }).eq('id', wId);
    toast.success(`Saque ${status === 'paid' ? 'pago' : 'rejeitado'}.`);
    loadAll();
  };

  // --- Edit ---
  const openEdit = (aff: any) => {
    setEditingId(aff.id);
    setEditUserId(aff.user_id || null);
    setEditForm({
      name: aff.name || '',
      email: aff.email || '',
      phone: aff.phone || '',
      document: aff.document || '',
      commission_percent: String(aff.commission_percent ?? 10),
      pix_key: aff.pix_key || '',
      referral_code: aff.referral_code || '',
      notes: aff.notes || '',
    });
    setNewPassword('');
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    if (!editForm.name || !editForm.email) {
      toast.error('Nome e e-mail são obrigatórios.');
      return;
    }
    setSavingEdit(true);
    try {
      const { error } = await supabase.from('affiliates').update({
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone || null,
        document: editForm.document || null,
        commission_percent: parseFloat(editForm.commission_percent) || 10,
        pix_key: editForm.pix_key || null,
        referral_code: editForm.referral_code,
        notes: editForm.notes || null,
      }).eq('id', editingId);
      if (error) throw error;
      toast.success('Afiliado atualizado com sucesso.');
      setEditOpen(false);
      loadAll();
    } catch (err: any) {
      console.error(err);
      if (err?.code === '23505') {
        toast.error('E-mail ou código de referência já em uso.');
      } else {
        toast.error('Erro ao salvar alterações.');
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const handleResetPassword = async () => {
    if (!editUserId || !newPassword) {
      toast.error('Informe a nova senha.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setResettingPassword(true);
    try {
      const { error } = await supabase.functions.invoke('create-user', {
        body: { action: 'update-password', user_id: editUserId, new_password: newPassword },
      });
      if (error) throw error;
      toast.success('Senha alterada com sucesso.');
      setNewPassword('');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao alterar senha.');
    } finally {
      setResettingPassword(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!editingId || !newPassword || !editForm.email) {
      toast.error('Informe a senha.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setResettingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: { email: editForm.email, password: newPassword, fullName: editForm.name, role: 'seller' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const userId = data?.user?.id;
      if (userId) {
        await supabase.from('affiliates').update({ user_id: userId }).eq('id', editingId);
        setEditUserId(userId);
      }
      toast.success('Conta criada com sucesso!');
      setNewPassword('');
      loadAll();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Erro ao criar conta.');
    } finally {
      setResettingPassword(false);
    }
  };

  // --- Delete ---
  const confirmDelete = (aff: any) => {
    setDeletingId(aff.id);
    setDeletingName(aff.name);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const { error } = await supabase.from('affiliates').delete().eq('id', deletingId);
      if (error) throw error;
      toast.success('Afiliado excluído.');
      setDeleteOpen(false);
      loadAll();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir afiliado.');
    }
  };

  // --- Detail ---
  const openDetail = (aff: any) => {
    setSelectedAffiliate(aff);
    setDetailOpen(true);
  };

  const filtered = affiliates.filter(a =>
    a.name?.toLowerCase().includes(search.toLowerCase()) || a.email?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPending = withdrawals.filter(w => w.status === 'pending').length;
  const affSales = selectedAffiliate ? sales.filter(s => s.affiliate_id === selectedAffiliate.id) : [];

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6" /> Afiliados</h1>
            <p className="text-sm text-muted-foreground">{affiliates.length} afiliados cadastrados</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{affiliates.filter(a => a.status === 'active').length}</p><p className="text-xs text-muted-foreground">Ativos</p></CardContent></Card>
          <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{affiliates.filter(a => a.status === 'pending').length}</p><p className="text-xs text-muted-foreground">Pendentes</p></CardContent></Card>
          <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">R$ {sales.reduce((s, v) => s + Number(v.commission_amount || 0), 0).toFixed(2)}</p><p className="text-xs text-muted-foreground">Comissões Totais</p></CardContent></Card>
          <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{totalPending}</p><p className="text-xs text-muted-foreground">Saques Pendentes</p></CardContent></Card>
        </div>

        <Tabs defaultValue="affiliates">
          <TabsList className="mb-4">
            <TabsTrigger value="affiliates">Afiliados</TabsTrigger>
            <TabsTrigger value="withdrawals">Saques {totalPending > 0 && <Badge variant="destructive" className="ml-1 text-xs">{totalPending}</Badge>}</TabsTrigger>
          </TabsList>

          <TabsContent value="affiliates">
            <Input placeholder="Buscar por nome ou e-mail..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm mb-4" />
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Comissão %</TableHead>
                      <TableHead>Cliques</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell>{a.email}</TableCell>
                        <TableCell className="font-mono text-xs">{a.referral_code}</TableCell>
                        <TableCell>
                          <Input type="number" className="w-20 h-8" defaultValue={a.commission_percent} onBlur={(e) => updateCommission(a.id, e.target.value)} min={0} max={100} />
                        </TableCell>
                        <TableCell>{a.clicks}</TableCell>
                        <TableCell><Badge variant={statusColors[a.status] || 'outline'}>{statusLabels[a.status] || a.status}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" title="Ver detalhes" onClick={() => openDetail(a)}><Eye className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" title="Editar" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" title="Excluir" className="text-destructive" onClick={() => confirmDelete(a)}><Trash2 className="h-4 w-4" /></Button>
                            {a.status === 'pending' && (
                              <Button size="icon" variant="ghost" className="text-green-600" title="Aprovar" onClick={() => updateAffiliateStatus(a.id, 'active')}><Check className="h-4 w-4" /></Button>
                            )}
                            {a.status === 'active' && (
                              <Button size="icon" variant="ghost" className="text-destructive" title="Bloquear" onClick={() => updateAffiliateStatus(a.id, 'blocked')}><X className="h-4 w-4" /></Button>
                            )}
                            {a.status === 'blocked' && (
                              <Button size="icon" variant="ghost" className="text-green-600" title="Reativar" onClick={() => updateAffiliateStatus(a.id, 'active')}><Check className="h-4 w-4" /></Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="withdrawals">
            {withdrawals.length === 0 ? (
              <p className="text-muted-foreground">Nenhum saque solicitado.</p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Afiliado</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>PIX</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals.map((w) => {
                      const aff = affiliates.find(a => a.id === w.affiliate_id);
                      return (
                        <TableRow key={w.id}>
                          <TableCell>{aff?.name || '—'}</TableCell>
                          <TableCell>R$ {Number(w.amount).toFixed(2)}</TableCell>
                          <TableCell className="font-mono text-xs">{w.pix_key || '—'}</TableCell>
                          <TableCell>{new Date(w.created_at).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell><Badge variant={statusColors[w.status] || 'outline'}>{w.status === 'paid' ? 'Pago' : w.status === 'pending' ? 'Pendente' : 'Rejeitado'}</Badge></TableCell>
                          <TableCell>
                            {w.status === 'pending' && (
                              <div className="flex gap-1">
                                <Button size="sm" variant="outline" onClick={() => processWithdrawal(w.id, 'paid')}>Pagar</Button>
                                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => processWithdrawal(w.id, 'rejected')}>Rejeitar</Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Detail modal */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Detalhes — {selectedAffiliate?.name}</DialogTitle></DialogHeader>
            {selectedAffiliate && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">E-mail:</span> {selectedAffiliate.email}</div>
                  <div><span className="text-muted-foreground">Telefone:</span> {selectedAffiliate.phone}</div>
                  <div><span className="text-muted-foreground">Documento:</span> {selectedAffiliate.document || '—'}</div>
                  <div><span className="text-muted-foreground">Código:</span> <span className="font-mono">{selectedAffiliate.referral_code}</span></div>
                  <div><span className="text-muted-foreground">Saldo Pendente:</span> R$ {Number(selectedAffiliate.balance_pending).toFixed(2)}</div>
                  <div><span className="text-muted-foreground">Saldo Disponível:</span> R$ {Number(selectedAffiliate.balance_available).toFixed(2)}</div>
                  <div><span className="text-muted-foreground">PIX:</span> {selectedAffiliate.pix_key || '—'}</div>
                  <div><span className="text-muted-foreground">Cadastro:</span> {new Date(selectedAffiliate.created_at).toLocaleDateString('pt-BR')}</div>
                </div>
                {selectedAffiliate.notes && (
                  <div className="text-sm"><span className="text-muted-foreground">Observações:</span> {selectedAffiliate.notes}</div>
                )}
                <Separator />
                <h4 className="font-semibold">Vendas ({affSales.length})</h4>
                {affSales.length > 0 ? (
                  <Table>
                    <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Valor</TableHead><TableHead>Comissão</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
                    <TableBody>
                      {affSales.map(s => (
                        <TableRow key={s.id}>
                          <TableCell>{new Date(s.created_at).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell>R$ {Number(s.sale_amount).toFixed(2)}</TableCell>
                          <TableCell>R$ {Number(s.commission_amount).toFixed(2)}</TableCell>
                          <TableCell><Badge variant={statusColors[s.status] || 'outline'}>{s.status}</Badge></TableCell>
                          <TableCell>
                            {s.status === 'pending' && (
                              <div className="flex gap-1">
                                <Button size="sm" variant="outline" onClick={() => updateSaleStatus(s.id, 'approved')}>Aprovar</Button>
                                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => updateSaleStatus(s.id, 'rejected')}>Rejeitar</Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : <p className="text-sm text-muted-foreground">Sem vendas.</p>}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit modal */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Editar Afiliado</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome *</Label>
                <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} maxLength={100} />
              </div>
              <div>
                <Label>E-mail *</Label>
                <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} maxLength={255} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Telefone</Label>
                  <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} maxLength={20} />
                </div>
                <div>
                  <Label>CPF/CNPJ</Label>
                  <Input value={editForm.document} onChange={(e) => setEditForm({ ...editForm, document: e.target.value })} maxLength={18} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Código de Referência</Label>
                  <Input value={editForm.referral_code} onChange={(e) => setEditForm({ ...editForm, referral_code: e.target.value })} className="font-mono" />
                </div>
                <div>
                  <Label>Comissão (%)</Label>
                  <Input type="number" value={editForm.commission_percent} onChange={(e) => setEditForm({ ...editForm, commission_percent: e.target.value })} min={0} max={100} />
                </div>
              </div>
              <div>
                <Label>Chave PIX</Label>
                <Input value={editForm.pix_key} onChange={(e) => setEditForm({ ...editForm, pix_key: e.target.value })} />
              </div>
              <div>
                <Label>Observações</Label>
                <Input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
              </div>

              <Button onClick={handleSaveEdit} disabled={savingEdit} className="w-full">
                {savingEdit ? 'Salvando...' : 'Salvar Alterações'}
              </Button>

              {/* Password section */}
              <Separator />
              <div className="space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <KeyRound className="h-4 w-4" /> 
                  {editUserId ? 'Alterar Senha do Afiliado' : 'Criar Conta de Acesso'}
                </h4>
                {!editUserId && (
                  <p className="text-xs text-muted-foreground">
                    Este afiliado ainda não possui conta de acesso. Crie uma senha para que ele possa acessar o painel.
                  </p>
                )}
                <div>
                  <Label>{editUserId ? 'Nova Senha' : 'Senha'}</Label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} />
                </div>
                <Button variant="outline" onClick={editUserId ? handleResetPassword : handleCreateAccount} disabled={resettingPassword || !newPassword} className="w-full">
                  {resettingPassword ? (editUserId ? 'Alterando...' : 'Criando...') : (editUserId ? 'Alterar Senha' : 'Criar Conta')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Afiliado</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o afiliado <strong>{deletingName}</strong>? Esta ação não pode ser desfeita e todas as vendas e saques associados serão removidos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
};

export default Affiliates;
