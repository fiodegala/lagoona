import { useState, useEffect } from 'react';
import { Users, Check, X, Eye, DollarSign, Loader2 } from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
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
  const [selectedAffiliate, setSelectedAffiliate] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);

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

  const filtered = affiliates.filter(a =>
    a.name?.toLowerCase().includes(search.toLowerCase()) || a.email?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPending = withdrawals.filter(w => w.status === 'pending').length;

  const openDetail = (aff: any) => {
    setSelectedAffiliate(aff);
    setDetailOpen(true);
  };

  const affSales = selectedAffiliate ? sales.filter(s => s.affiliate_id === selectedAffiliate.id) : [];
  const affWithdrawals = selectedAffiliate ? withdrawals.filter(w => w.affiliate_id === selectedAffiliate.id) : [];

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
                            <Button size="icon" variant="ghost" onClick={() => openDetail(a)}><Eye className="h-4 w-4" /></Button>
                            {a.status === 'pending' && (
                              <>
                                <Button size="icon" variant="ghost" className="text-green-600" onClick={() => updateAffiliateStatus(a.id, 'active')}><Check className="h-4 w-4" /></Button>
                                <Button size="icon" variant="ghost" className="text-red-600" onClick={() => updateAffiliateStatus(a.id, 'blocked')}><X className="h-4 w-4" /></Button>
                              </>
                            )}
                            {a.status === 'active' && (
                              <Button size="icon" variant="ghost" className="text-red-600" onClick={() => updateAffiliateStatus(a.id, 'blocked')}><X className="h-4 w-4" /></Button>
                            )}
                            {a.status === 'blocked' && (
                              <Button size="icon" variant="ghost" className="text-green-600" onClick={() => updateAffiliateStatus(a.id, 'active')}><Check className="h-4 w-4" /></Button>
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
                                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => processWithdrawal(w.id, 'rejected')}>Rejeitar</Button>
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
                </div>
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
                                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => updateSaleStatus(s.id, 'rejected')}>Rejeitar</Button>
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
      </div>
    </AdminLayout>
  );
};

export default Affiliates;
