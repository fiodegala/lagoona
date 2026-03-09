import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, DollarSign, TrendingUp, MousePointerClick, ArrowDownToLine, Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import StoreLayout from '@/components/store/StoreLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'outline' },
  approved: { label: 'Aprovada', variant: 'default' },
  paid: { label: 'Paga', variant: 'secondary' },
  rejected: { label: 'Rejeitada', variant: 'destructive' },
};

const AffiliateDashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [affiliate, setAffiliate] = useState<any>(null);
  const [sales, setSales] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/conta/login');
      return;
    }
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: aff } = await supabase.from('affiliates').select('*').eq('user_id', user.id).maybeSingle();
      if (!aff) {
        toast.error('Nenhum cadastro de afiliado encontrado para esta conta.');
        navigate('/afiliados');
        return;
      }
      setAffiliate(aff);
      setPixKey(aff.pix_key || '');

      const { data: salesData } = await supabase
        .from('affiliate_sales')
        .select('*')
        .eq('affiliate_id', aff.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setSales(salesData || []);

      const { data: wData } = await supabase
        .from('affiliate_withdrawals')
        .select('*')
        .eq('affiliate_id', aff.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setWithdrawals(wData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!affiliate) return;
    const link = `${window.location.origin}/r/${affiliate.referral_code}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copiado!');
  };

  const handleWithdraw = async () => {
    if (!affiliate) return;
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0 || amount > affiliate.balance_available) {
      toast.error('Valor inválido.');
      return;
    }
    setSubmittingWithdraw(true);
    try {
      const { error } = await supabase.from('affiliate_withdrawals').insert({
        affiliate_id: affiliate.id,
        amount,
        pix_key: pixKey || affiliate.pix_key,
      });
      if (error) throw error;
      // Update pix_key if changed
      if (pixKey !== affiliate.pix_key) {
        await supabase.from('affiliates').update({ pix_key: pixKey }).eq('id', affiliate.id);
      }
      toast.success('Solicitação de saque enviada!');
      setWithdrawOpen(false);
      setWithdrawAmount('');
      loadData();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao solicitar saque.');
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  if (loading) {
    return (
      <StoreLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </StoreLayout>
    );
  }

  if (!affiliate) return null;

  const referralLink = `${window.location.origin}/r/${affiliate.referral_code}`;

  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Painel do Afiliado</h1>
          <Badge variant={affiliate.status === 'active' ? 'default' : 'outline'}>
            {affiliate.status === 'active' ? 'Ativo' : affiliate.status === 'pending' ? 'Pendente' : 'Bloqueado'}
          </Badge>
        </div>

        {/* Link de referência */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <Label className="text-sm text-muted-foreground">Seu link de indicação</Label>
            <div className="flex gap-2 mt-1">
              <Input value={referralLink} readOnly className="font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={handleCopyLink}><Copy className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 text-center">
              <MousePointerClick className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">{affiliate.clicks}</p>
              <p className="text-xs text-muted-foreground">Cliques</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <TrendingUp className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">{sales.length}</p>
              <p className="text-xs text-muted-foreground">Vendas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <DollarSign className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">R$ {Number(affiliate.balance_pending || 0).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Pendente</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <DollarSign className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold text-primary">R$ {Number(affiliate.balance_available || 0).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Disponível</p>
            </CardContent>
          </Card>
        </div>

        {/* Withdraw button */}
        {affiliate.status === 'active' && affiliate.balance_available > 0 && (
          <div className="mb-6">
            <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
              <DialogTrigger asChild>
                <Button><ArrowDownToLine className="h-4 w-4 mr-2" /> Solicitar Saque</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Solicitar Saque</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Saldo disponível: <strong>R$ {Number(affiliate.balance_available).toFixed(2)}</strong></p>
                  <div>
                    <Label>Valor do Saque (R$)</Label>
                    <Input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} max={affiliate.balance_available} step="0.01" />
                  </div>
                  <div>
                    <Label>Chave PIX</Label>
                    <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="CPF, e-mail ou chave aleatória" />
                  </div>
                  <Button onClick={handleWithdraw} disabled={submittingWithdraw} className="w-full">
                    {submittingWithdraw ? 'Enviando...' : 'Confirmar Saque'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* Sales history */}
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-lg">Histórico de Vendas</CardTitle></CardHeader>
          <CardContent>
            {sales.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma venda registrada ainda.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Valor Venda</TableHead>
                    <TableHead>Comissão</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{new Date(s.created_at).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>R$ {Number(s.sale_amount).toFixed(2)}</TableCell>
                      <TableCell>R$ {Number(s.commission_amount).toFixed(2)}</TableCell>
                      <TableCell><Badge variant={statusMap[s.status]?.variant || 'outline'}>{statusMap[s.status]?.label || s.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Withdrawals */}
        {withdrawals.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Saques</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawals.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell>{new Date(w.created_at).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>R$ {Number(w.amount).toFixed(2)}</TableCell>
                      <TableCell><Badge variant={statusMap[w.status]?.variant || 'outline'}>{statusMap[w.status]?.label || w.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </StoreLayout>
  );
};

export default AffiliateDashboardPage;
