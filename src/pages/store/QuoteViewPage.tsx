import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import StoreHeader from '@/components/store/StoreHeader';
import StoreFooter from '@/components/store/StoreFooter';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, FileText, User, CreditCard, Package, Clock, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface QuoteData {
  id: string;
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

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'bg-amber-100 text-amber-800' },
  converted: { label: 'Convertido em Venda', color: 'bg-green-100 text-green-800' },
  expired: { label: 'Expirado', color: 'bg-red-100 text-red-800' },
  cancelled: { label: 'Cancelado', color: 'bg-gray-100 text-gray-600' },
};

const paymentMethodLabels: Record<string, string> = {
  cash: 'Dinheiro',
  card: 'Cartão',
  pix: 'PIX',
  mixed: 'Misto',
};

const QuoteViewPage = () => {
  const { id } = useParams<{ id: string }>();
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchQuote = async () => {
      if (!id) { setError(true); setLoading(false); return; }
      try {
        const { data, error: fnError } = await supabase.functions.invoke('public-quote', {
          body: null,
          headers: {},
        });
        // Use query param approach
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-quote?id=${id}`,
          { headers: { 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
        );
        if (!response.ok) throw new Error('Not found');
        const result = await response.json();
        setQuote(result);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchQuote();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !quote) {
    return (
      <>
        <StoreHeader categories={[]} />
        <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
          <FileText className="h-16 w-16 text-muted-foreground/40 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Orçamento não encontrado</h1>
          <p className="text-muted-foreground">Este orçamento pode ter sido removido ou o link está incorreto.</p>
        </div>
        <StoreFooter />
      </>
    );
  }

  const st = statusMap[quote.status] || statusMap.pending;
  const paymentLabel = quote.payment_method ? (paymentMethodLabels[quote.payment_method] || quote.payment_method) : null;

  let paymentDetail = '';
  if (quote.payment_method === 'card' && quote.payment_details) {
    const cardLabel = quote.payment_details.cardType === 'credit' ? 'Cartão de Crédito' : 'Cartão de Débito';
    const inst = quote.payment_details.installments || 1;
    paymentDetail = inst > 1 ? `${cardLabel} — ${inst}x de ${formatCurrency(quote.total / inst)} sem juros` : `${cardLabel} — À vista`;
  } else if (quote.payment_method === 'mixed' && quote.payment_details) {
    const parts: string[] = [];
    if (quote.payment_details.cash > 0) parts.push(`Dinheiro: ${formatCurrency(quote.payment_details.cash)}`);
    if (quote.payment_details.card > 0) parts.push(`Cartão: ${formatCurrency(quote.payment_details.card)}`);
    if (quote.payment_details.pix > 0) parts.push(`PIX: ${formatCurrency(quote.payment_details.pix)}`);
    paymentDetail = parts.join(' • ');
  }

  return (
    <>
      <StoreHeader categories={[]} />
      <div className="min-h-[60vh] bg-gradient-to-b from-muted/30 to-background py-8 sm:py-12 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header Card */}
          <div className="bg-card rounded-2xl shadow-lg border overflow-hidden">
            {/* Top accent */}
            <div className="h-2 bg-gradient-to-r from-primary to-accent" />

            <div className="p-6 sm:p-8">
              {/* Title + Status */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-5 w-5 text-primary" />
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Orçamento</h1>
                  </div>
                  <p className="text-sm text-muted-foreground font-mono">#{quote.id.slice(0, 8).toUpperCase()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${st.color}`}>
                    {st.label}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => window.print()} className="print:hidden">
                    <Printer className="h-4 w-4 mr-1" />
                    Imprimir
                  </Button>
                </div>
              </div>

              {/* Date */}
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6">
                <Clock className="h-4 w-4" />
                Emitido em {format(new Date(quote.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
              </div>

              {/* Customer */}
              {quote.customer_name && (
                <>
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50 mb-6">
                    <User className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold">{quote.customer_name}</p>
                      {quote.customer_document && (
                        <p className="text-sm text-muted-foreground">{quote.customer_document}</p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Items */}
              <div className="mb-6">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Package className="h-4 w-4" />
                  Itens do Orçamento
                </h2>
                <div className="space-y-3">
                  {(quote.items || []).map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-4 p-3 rounded-xl border bg-background">
                      <img
                        src={item.image_url || '/placeholder.svg'}
                        alt={item.name || 'Produto'}
                        className="h-16 w-16 rounded-lg object-cover border bg-muted shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.name || 'Produto'}</p>
                        {item.sku && <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>}
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {item.quantity || 1}x {formatCurrency(item.unit_price || 0)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-lg">{formatCurrency(item.total || (item.unit_price * item.quantity))}</p>
                        {item.discount_amount > 0 && (
                          <p className="text-xs text-red-500">-{formatCurrency(item.discount_amount)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator className="my-6" />

              {/* Totals */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(quote.subtotal)}</span>
                </div>
                {quote.discount_amount > 0 && (
                  <div className="flex justify-between text-red-500">
                    <span>Desconto</span>
                    <span>-{formatCurrency(quote.discount_amount)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-xl font-bold pt-1">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(quote.total)}</span>
                </div>
              </div>

              {/* Payment */}
              {paymentLabel && (
                <>
                  <Separator className="my-6" />
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50">
                    <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold">{paymentLabel}</p>
                      {paymentDetail && <p className="text-sm text-muted-foreground">{paymentDetail}</p>}
                    </div>
                  </div>
                </>
              )}

              {/* Notes */}
              {quote.notes && (
                <>
                  <Separator className="my-6" />
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200/50">
                    <p className="text-sm font-semibold text-amber-800 mb-1">Observações</p>
                    <p className="text-sm text-amber-700">{quote.notes}</p>
                  </div>
                </>
              )}

              {/* Expiry */}
              {quote.expires_at && (
                <p className="text-xs text-center text-muted-foreground mt-6">
                  Válido até {format(new Date(quote.expires_at), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              )}
              {!quote.expires_at && (
                <p className="text-xs text-center text-muted-foreground mt-6">
                  Orçamento sujeito a alteração sem aviso prévio
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
      <StoreFooter />

      {/* Print styles */}
      <style>{`
        @media print {
          header, footer, .print\\:hidden { display: none !important; }
          body { background: white !important; }
          .bg-gradient-to-b { background: white !important; }
        }
      `}</style>
    </>
  );
};

export default QuoteViewPage;
