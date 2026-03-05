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
import { ScrollArea } from '@/components/ui/scroll-area';
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
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  converted: { label: 'Convertido', variant: 'default' },
  expired: { label: 'Expirado', variant: 'destructive' },
  cancelled: { label: 'Cancelado', variant: 'outline' },
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
                          <TableCell>{format(new Date(q.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</TableCell>
                          <TableCell>{q.customer_name || '—'}</TableCell>
                          <TableCell>{(q.items || []).length}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(q.total)}</TableCell>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Orçamento #{selectedQuote?.id.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          {selectedQuote && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Data:</span> {format(new Date(selectedQuote.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</div>
                <div><span className="text-muted-foreground">Cliente:</span> {selectedQuote.customer_name || '—'}</div>
                {selectedQuote.customer_document && <div><span className="text-muted-foreground">Documento:</span> {selectedQuote.customer_document}</div>}
              </div>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Itens</h4>
                {(selectedQuote.items || []).map((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{item.quantity}x {item.name}</span>
                    <span className="font-medium">{formatCurrency(item.total || item.unit_price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(selectedQuote.subtotal)}</span></div>
                {selectedQuote.discount_amount > 0 && (
                  <div className="flex justify-between text-destructive"><span>Desconto</span><span>-{formatCurrency(selectedQuote.discount_amount)}</span></div>
                )}
                <div className="flex justify-between text-lg font-bold"><span>Total</span><span className="text-primary">{formatCurrency(selectedQuote.total)}</span></div>
              </div>
              {selectedQuote.notes && (
                <>
                  <Separator />
                  <p className="text-sm text-muted-foreground">{selectedQuote.notes}</p>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default Quotes;
