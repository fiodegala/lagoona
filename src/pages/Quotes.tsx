import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

import { Search, FileText, Eye, Trash2, Loader2, Clock, User, CreditCard, Package } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Quote {
  id: string;
  local_id: string;
  customer_name: string | null;
  customer_document: string | null;
  items: any[];
  subtotal: number;
  discount_amount: number;
  total: number;
  status: string;
  notes: string | null;
  created_at: string;
  expires_at: string | null;
  payment_method: string | null;
  payment_details: Record<string, any> | null;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  converted: { label: 'Convertido', variant: 'default' },
  expired: { label: 'Expirado', variant: 'destructive' },
  cancelled: { label: 'Cancelado', variant: 'outline' },
};

const paymentMethodLabels: Record<string, string> = {
  cash: 'Dinheiro',
  card: 'Cartão',
  pix: 'PIX',
  mixed: 'Misto',
};

const Quotes = () => {
  const { toast } = useToast();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);

  const fetchQuotes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      toast({ title: 'Erro ao carregar orçamentos', variant: 'destructive' });
    } else {
      setQuotes((data || []) as unknown as Quote[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchQuotes(); }, []);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('quotes').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    } else {
      toast({ title: 'Orçamento excluído' });
      setQuotes(q => q.filter(x => x.id !== id));
      if (selectedQuote?.id === id) setSelectedQuote(null);
    }
  };

  const filtered = quotes.filter(q =>
    !search || (q.customer_name || '').toLowerCase().includes(search.toLowerCase()) ||
    q.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Orçamentos</h1>
            <p className="text-muted-foreground">Orçamentos gerados pelo PDV</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {filtered.length} orçamento(s)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Nenhum orçamento encontrado</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Itens</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(q => {
                      const st = statusMap[q.status] || statusMap.pending;
                      return (
                        <TableRow key={q.id}>
                          <TableCell className="font-mono text-xs">{q.id.slice(0, 8)}</TableCell>
                          <TableCell className="whitespace-nowrap">{format(new Date(q.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</TableCell>
                          <TableCell>{q.customer_name || '—'}</TableCell>
                          <TableCell>{(q.items || []).length}</TableCell>
                          <TableCell className="whitespace-nowrap">{q.payment_method ? (paymentMethodLabels[q.payment_method] || q.payment_method) : '—'}</TableCell>
                          <TableCell className="text-right font-semibold whitespace-nowrap">{formatCurrency(q.total)}</TableCell>
                          <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => setSelectedQuote(q)}><Eye className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(q.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selectedQuote} onOpenChange={open => !open && setSelectedQuote(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 shrink-0" />
              Orçamento #{selectedQuote?.id.slice(0, 8).toUpperCase()}
            </DialogTitle>
          </DialogHeader>
          {selectedQuote && (
            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              <div className="space-y-5 py-2 px-1">
                {/* Status e Data */}
                <div className="flex items-center justify-between">
                  <Badge variant={(statusMap[selectedQuote.status] || statusMap.pending).variant}>
                    {(statusMap[selectedQuote.status] || statusMap.pending).label}
                  </Badge>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(new Date(selectedQuote.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </div>
                </div>

                <Separator />

                {/* Cliente */}
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    Cliente
                  </h4>
                  <div className="text-sm space-y-0.5">
                    <p className="font-medium">{selectedQuote.customer_name || 'Não informado'}</p>
                    {selectedQuote.customer_document && (
                      <p className="text-muted-foreground">Documento: {selectedQuote.customer_document}</p>
                    )}
                  </div>
                </div>

                {/* Pagamento */}
                {selectedQuote.payment_method && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                        Forma de Pagamento
                      </h4>
                      <div className="text-sm space-y-0.5">
                        <p className="font-medium">
                          {paymentMethodLabels[selectedQuote.payment_method] || selectedQuote.payment_method}
                        </p>
                        {selectedQuote.payment_method === 'card' && selectedQuote.payment_details && (
                          <>
                            <p className="text-muted-foreground">
                              {selectedQuote.payment_details.cardType === 'credit' ? 'Cartão de Crédito' : 'Cartão de Débito'}
                            </p>
                            {selectedQuote.payment_details.cardType === 'credit' && selectedQuote.payment_details.installments > 1 && (
                              <p className="text-muted-foreground">
                                {selectedQuote.payment_details.installments}x de {formatCurrency(selectedQuote.total / selectedQuote.payment_details.installments)} sem juros
                              </p>
                            )}
                            {selectedQuote.payment_details.cardType === 'credit' && (selectedQuote.payment_details.installments || 1) === 1 && (
                              <p className="text-muted-foreground">À vista</p>
                            )}
                          </>
                        )}
                        {selectedQuote.payment_method === 'mixed' && selectedQuote.payment_details && (
                          <div className="text-muted-foreground space-y-0.5">
                            {selectedQuote.payment_details.cash > 0 && <p>Dinheiro: {formatCurrency(selectedQuote.payment_details.cash)}</p>}
                            {selectedQuote.payment_details.card > 0 && <p>Cartão: {formatCurrency(selectedQuote.payment_details.card)}</p>}
                            {selectedQuote.payment_details.pix > 0 && <p>PIX: {formatCurrency(selectedQuote.payment_details.pix)}</p>}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* Itens */}
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    Itens do Orçamento
                  </h4>
                  {(selectedQuote.items || []).length > 0 ? (
                    <div className="space-y-2">
                      {(selectedQuote.items || []).map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between rounded-md border p-2.5 text-sm">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={item.image_url || '/placeholder.svg'}
                              alt={item.name || 'Produto'}
                              className="h-12 w-12 rounded-md object-cover shrink-0 border bg-muted"
                            />
                            <div className="min-w-0">
                              <p className="font-medium truncate">{item.name || 'Produto'}</p>
                              {item.sku && <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>}
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <p className="font-medium">{formatCurrency(item.unit_price || 0)}</p>
                            <p className="text-xs text-muted-foreground">Qtd: {item.quantity || 1}</p>
                            {item.discount_amount > 0 && (
                              <p className="text-xs text-destructive">-{formatCurrency(item.discount_amount)}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum item</p>
                  )}
                </div>

                <Separator />

                {/* Totais */}
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(selectedQuote.subtotal)}</span>
                  </div>
                  {selectedQuote.discount_amount > 0 && (
                    <div className="flex justify-between text-destructive">
                      <span>Desconto</span>
                      <span>-{formatCurrency(selectedQuote.discount_amount)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-primary">{formatCurrency(selectedQuote.total)}</span>
                  </div>
                </div>

                {/* Validade */}
                {selectedQuote.expires_at && (
                  <>
                    <Separator />
                    <p className="text-xs text-muted-foreground">
                      Válido até: {format(new Date(selectedQuote.expires_at), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </>
                )}

                {/* Notas */}
                {selectedQuote.notes && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-semibold mb-1">Observações</h4>
                      <p className="text-sm text-muted-foreground">{selectedQuote.notes}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default Quotes;
