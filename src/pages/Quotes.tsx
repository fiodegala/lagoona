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
import QuoteEditModal from '@/components/QuoteEditModal';

import { Search, FileText, Eye, Trash2, Loader2, Clock, User, CreditCard, Package, Printer, Share2, Pencil, History, ShoppingCart, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Quote {
  id: string;
  local_id: string;
  customer_name: string | null;
  customer_document: string | null;
  customer_phone: string | null;
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

const handlePrintQuote = (quote: Quote) => {
  const items = (quote.items || []) as any[];
  const paymentLabel = quote.payment_method ? (paymentMethodLabels[quote.payment_method] || quote.payment_method) : null;
  
  let paymentDetail = '';
  if (quote.payment_method === 'card' && quote.payment_details) {
    const cardLabel = quote.payment_details.cardType === 'credit' ? 'Crédito' : 'Débito';
    const inst = quote.payment_details.installments || 1;
    paymentDetail = `${cardLabel}${inst > 1 ? ` - ${inst}x de ${formatCurrency(quote.total / inst)}` : ' - À vista'}`;
  } else if (quote.payment_method === 'mixed' && quote.payment_details) {
    const parts: string[] = [];
    if (quote.payment_details.cash > 0) parts.push(`Dinheiro: ${formatCurrency(quote.payment_details.cash)}`);
    if (quote.payment_details.card > 0) parts.push(`Cartão: ${formatCurrency(quote.payment_details.card)}`);
    if (quote.payment_details.pix > 0) parts.push(`PIX: ${formatCurrency(quote.payment_details.pix)}`);
    paymentDetail = parts.join(' | ');
  }

  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (!printWindow) return;

  printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Orçamento #${quote.id.slice(0, 8).toUpperCase()}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; color: #1a1a1a; font-size: 13px; max-width: 380px; margin: 0 auto; }
  .header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; }
  .header h1 { font-size: 18px; font-weight: 700; }
  .header p { font-size: 11px; color: #666; margin-top: 4px; }
  .section { margin-bottom: 12px; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #666; margin-bottom: 6px; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
  .info-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
  .info-label { color: #666; }
  .item { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px dotted #ddd; }
  .item-name { flex: 1; }
  .item-qty { width: 40px; text-align: center; color: #666; }
  .item-price { width: 80px; text-align: right; font-weight: 600; }
  .totals { margin-top: 12px; border-top: 2px solid #1a1a1a; padding-top: 8px; }
  .total-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
  .total-final { font-size: 16px; font-weight: 700; margin-top: 6px; padding-top: 6px; border-top: 1px solid #ddd; }
  .discount { color: #dc2626; }
  .footer { text-align: center; margin-top: 20px; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 8px; }
  @media print { body { padding: 12px; } }
</style></head><body>
  <div class="header">
    <h1>ORÇAMENTO</h1>
    <p>#${quote.id.slice(0, 8).toUpperCase()} &bull; ${format(new Date(quote.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
  </div>
  ${quote.customer_name ? `<div class="section">
    <div class="section-title">Cliente</div>
    <div class="info-row"><span>${quote.customer_name}</span></div>
    ${quote.customer_document ? `<div class="info-row"><span class="info-label">${quote.customer_document}</span></div>` : ''}
  </div>` : ''}
  <div class="section">
    <div class="section-title">Itens</div>
    ${items.map(item => `<div class="item">
      <div class="item-name">${item.name || 'Produto'}${item.sku ? `<br><span style="font-size:10px;color:#999">SKU: ${item.sku}</span>` : ''}</div>
      <div class="item-qty">${item.quantity || 1}x</div>
      <div class="item-price">${formatCurrency(item.total || (item.unit_price * item.quantity))}</div>
    </div>`).join('')}
  </div>
  <div class="totals">
    <div class="total-row"><span>Subtotal</span><span>${formatCurrency(quote.subtotal)}</span></div>
    ${quote.discount_amount > 0 ? `<div class="total-row discount"><span>Desconto</span><span>-${formatCurrency(quote.discount_amount)}</span></div>` : ''}
    <div class="total-row total-final"><span>Total</span><span>${formatCurrency(quote.total)}</span></div>
  </div>
  ${paymentLabel ? `<div class="section" style="margin-top:12px">
    <div class="section-title">Forma de Pagamento</div>
    <div class="info-row"><span>${paymentLabel}</span></div>
    ${paymentDetail ? `<div class="info-row"><span class="info-label">${paymentDetail}</span></div>` : ''}
  </div>` : ''}
  ${quote.notes ? `<div class="section"><div class="section-title">Observações</div><p>${quote.notes}</p></div>` : ''}
  ${quote.expires_at ? `<div class="footer">Válido até ${format(new Date(quote.expires_at), "dd/MM/yyyy", { locale: ptBR })}</div>` : '<div class="footer">Orçamento sujeito a alteração sem aviso prévio</div>'}
</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 300);
};

const Quotes = () => {
  const { toast } = useToast();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [editQuote, setEditQuote] = useState<Quote | null>(null);
  const [quoteHistory, setQuoteHistory] = useState<any[]>([]);
  const [converting, setConverting] = useState(false);

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

  // Fetch history when a quote is selected
  useEffect(() => {
    if (!selectedQuote) { setQuoteHistory([]); return; }
    const fetchHistory = async () => {
      const { data } = await supabase
        .from('quote_history' as any)
        .select('*')
        .eq('quote_id', selectedQuote.id)
        .order('created_at', { ascending: false });
      setQuoteHistory((data as any[]) || []);
    };
    fetchHistory();
  }, [selectedQuote]);

  const handleDelete = async (id: string) => {
    // Find the quote to restore stock if it's still pending
    const quoteToDelete = quotes.find(q => q.id === id);
    const { error } = await supabase.from('quotes').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    } else {
      // Restore stock if the quote was pending (reserved stock)
      if (quoteToDelete && quoteToDelete.status === 'pending') {
        try {
          const { restoreStockForQuote } = await import('@/services/quoteStockService');
          await restoreStockForQuote((quoteToDelete.items || []).map((item: any) => ({
            product_id: item.product_id,
            variation_id: item.variation_id || null,
            quantity: item.quantity || 1,
          })));
        } catch (err) {
          console.error('Error restoring stock:', err);
        }
      }
      toast({ title: 'Orçamento excluído' });
      setQuotes(q => q.filter(x => x.id !== id));
      if (selectedQuote?.id === id) setSelectedQuote(null);
    }
  };

  const handleConvertToSale = async (quote: Quote) => {
    if (!confirm('Deseja converter este orçamento em venda? Esta ação não pode ser desfeita.')) return;
    setConverting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      // Create POS sale from quote data
      const { data: sale, error: saleError } = await supabase.from('pos_sales').insert({
        local_id: quote.local_id || crypto.randomUUID(),
        user_id: user.id,
        customer_name: quote.customer_name,
        customer_document: quote.customer_document,
        customer_id: (quote as any).customer_id || null,
        items: quote.items as any,
        subtotal: quote.subtotal,
        discount_amount: quote.discount_amount || 0,
        discount_type: (quote as any).discount_type || null,
        discount_value: (quote as any).discount_value || 0,
        total: quote.total,
        payment_method: quote.payment_method || 'cash',
        payment_details: (quote.payment_details || {}) as any,
        store_id: (quote as any).store_id || null,
        notes: quote.notes ? `[Convertido do orçamento #${quote.id.slice(0, 8).toUpperCase()}] ${quote.notes}` : `Convertido do orçamento #${quote.id.slice(0, 8).toUpperCase()}`,
        status: 'completed',
      }).select('id').single();

      if (saleError) throw saleError;

      // Update quote status to converted
      await supabase.from('quotes').update({
        status: 'converted',
        converted_sale_id: sale.id,
      }).eq('id', quote.id);

      toast({ title: 'Orçamento convertido em venda!', description: `Venda #${sale.id.slice(0, 8).toUpperCase()} criada com sucesso.` });
      setSelectedQuote(null);
      fetchQuotes();
    } catch (err: any) {
      toast({ title: 'Erro ao converter', description: err.message, variant: 'destructive' });
    } finally {
      setConverting(false);
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
                          <TableCell>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge variant={st.variant}>{st.label}</Badge>
                              {q.status === 'pending' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" title="Estoque reservado para este orçamento">
                                  <Lock className="h-3 w-3" />
                                  Reservado
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => setSelectedQuote(q)}><Eye className="h-4 w-4" /></Button>
                              {q.status === 'pending' && (
                                <>
                                  <Button variant="ghost" size="icon" onClick={() => setEditQuote(q)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleConvertToSale(q)} title="Converter em Venda" className="text-green-600 hover:text-green-700"><ShoppingCart className="h-4 w-4" /></Button>
                                </>
                              )}
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
          <DialogHeader className="space-y-3">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 shrink-0" />
              Orçamento #{selectedQuote?.id.slice(0, 8).toUpperCase()}
            </DialogTitle>
            {selectedQuote && (
              <div className="flex flex-wrap gap-2">
                {selectedQuote.status === 'pending' && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => {
                      setEditQuote(selectedQuote);
                      setSelectedQuote(null);
                    }}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button size="sm" onClick={() => handleConvertToSale(selectedQuote)} disabled={converting}
                      className="bg-green-600 hover:bg-green-700 text-white">
                      {converting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ShoppingCart className="h-4 w-4 mr-1" />}
                      Converter em Venda
                    </Button>
                  </>
                )}
                <Button variant="outline" size="sm" onClick={() => {
                  const publishedUrl = 'https://fiodegalafdg.lovable.app';
                  const url = `${publishedUrl}/orcamento/${selectedQuote.id}`;
                  navigator.clipboard.writeText(url);
                  toast({ title: 'Link copiado!', description: 'Envie o link para o cliente visualizar o orçamento.' });
                }}>
                  <Share2 className="h-4 w-4 mr-1" />
                  Copiar Link
                </Button>
                <Button variant="outline" size="sm" onClick={() => {
                  const publishedUrl = 'https://fiodegalafdg.lovable.app';
                  const url = `${publishedUrl}/orcamento/${selectedQuote.id}`;
                  const customerName = selectedQuote.customer_name || 'Cliente';
                  const total = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedQuote.total);
                  const message = `Olá ${customerName}! 👋\n\nSegue o orçamento no valor de *${total}*:\n${url}\n\nQualquer dúvida estamos à disposição! 😊`;
                  const phone = selectedQuote.customer_phone ? selectedQuote.customer_phone.replace(/\D/g, '') : '';
                  const phoneParam = phone ? `55${phone.replace(/^55/, '')}` : '';
                  window.open(`https://wa.me/${phoneParam}?text=${encodeURIComponent(message)}`, '_blank');
                }} className="text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700">
                  <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp
                </Button>
                <Button variant="outline" size="sm" onClick={() => handlePrintQuote(selectedQuote)}>
                  <Printer className="h-4 w-4 mr-1" />
                  Imprimir
                </Button>
              </div>
            )}
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

                {/* Histórico de Alterações */}
                {quoteHistory.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                        <History className="h-3.5 w-3.5 text-muted-foreground" />
                        Histórico de Alterações
                      </h4>
                      <div className="space-y-2">
                        {quoteHistory.map((entry: any) => (
                          <div key={entry.id} className="rounded-md border p-2.5 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{entry.user_name || 'Usuário'}</span>
                              <span className="text-muted-foreground">
                                {format(new Date(entry.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                            {entry.changes && Object.keys(entry.changes).length > 0 && (
                              <div className="text-muted-foreground space-y-0.5">
                                {Object.entries(entry.changes).map(([key, val]: [string, any]) => {
                                  const labels: Record<string, string> = {
                                    customer_name: 'Cliente',
                                    notes: 'Observações',
                                    payment_method: 'Pagamento',
                                    total: 'Total',
                                  };
                                  const label = labels[key] || key;
                                  if (key === 'total') {
                                    return <p key={key}>{label}: {formatCurrency(val.from)} → {formatCurrency(val.to)}</p>;
                                  }
                                  return <p key={key}>{label} alterado</p>;
                                })}
                              </div>
                            )}
                            {(!entry.changes || Object.keys(entry.changes).length === 0) && (
                              <p className="text-muted-foreground">Edição realizada</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <QuoteEditModal
        quote={editQuote as any}
        open={!!editQuote}
        onOpenChange={open => !open && setEditQuote(null)}
        onSaved={() => {
          fetchQuotes();
          setEditQuote(null);
        }}
      />
    </AdminLayout>
  );
};

export default Quotes;
