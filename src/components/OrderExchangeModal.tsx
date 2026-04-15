import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ArrowLeftRight, Search, RotateCcw, Package, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OrderExchangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any | null;
  onExchangeComplete: () => void;
}

interface SearchResult {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  variations: Array<{
    id: string;
    sku: string | null;
    price: number | null;
    stock: number;
    is_active: boolean;
    image_url?: string | null;
    label?: string;
  }>;
}

const OrderExchangeModal = ({ open, onOpenChange, order, onExchangeComplete }: OrderExchangeModalProps) => {
  const [step, setStep] = useState<'select-return' | 'select-new' | 'confirm'>('select-return');
  const [returnItem, setReturnItem] = useState<any>(null);
  const [newProduct, setNewProduct] = useState<SearchResult | null>(null);
  const [newVariation, setNewVariation] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [processing, setProcessing] = useState(false);

  const items = (() => {
    if (!order) return [];
    try {
      const parsed = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      return Array.isArray(parsed) ? parsed.filter((i: any) => !i.exchanged) : [];
    } catch {
      return [];
    }
  })();

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const term = searchQuery.trim();
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, image_url')
        .ilike('name', `%${term}%`)
        .eq('is_active', true)
        .limit(10);

      if (error) throw error;

      const productIds = (data || []).map(p => p.id);
      let variationsList: any[] = [];
      if (productIds.length > 0) {
        const { data: variations } = await supabase
          .from('product_variations')
          .select(`
            id, product_id, sku, price, stock, is_active, image_url,
            product_attribute_values (
              value,
              product_attributes ( name )
            )
          `)
          .in('product_id', productIds);
        variationsList = variations || [];
      }

      const results: SearchResult[] = (data || []).map(p => ({
        ...p,
        variations: variationsList
          .filter(v => v.product_id === p.id)
          .map(v => {
            const attrParts = (v.product_attribute_values || [])
              .map((av: any) => av.value)
              .filter(Boolean);
            const label = attrParts.length > 0 ? attrParts.join(' / ') : (v.sku || v.id.slice(0, 6));
            return { ...v, label };
          }),
      }));

      setSearchResults(results);
    } catch {
      toast.error('Erro ao buscar produtos');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectReturnItem = (item: any) => {
    setReturnItem(item);
    setStep('select-new');
  };

  const handleSelectNewProduct = (product: SearchResult, variation?: any) => {
    setNewProduct(product);
    setNewVariation(variation || null);
    setStep('confirm');
  };

  const handleConfirmExchange = async () => {
    if (!order || !returnItem || !newProduct) return;
    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const newPrice = newVariation?.price || newProduct.price;
      
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/order-exchange`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            order_id: order.id,
            return_item: {
              product_id: returnItem.product_id,
              variation_id: returnItem.variation_id || null,
              quantity: returnItem.quantity || 1,
              product_name: returnItem.name || returnItem.product_name,
              variation_label: returnItem.variation_label || returnItem.variation || null,
            },
            new_item: {
              product_id: newProduct.id,
              variation_id: newVariation?.id || null,
              quantity: returnItem.quantity || 1,
              product_name: newProduct.name,
              variation_label: newVariation?.label || null,
              price: newPrice,
              image_url: newVariation?.image_url || newProduct.image_url,
              sku: newVariation?.sku || null,
            },
          }),
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao processar troca');

      toast.success('Troca realizada com sucesso!');
      onExchangeComplete();
      handleClose();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar troca');
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    setStep('select-return');
    setReturnItem(null);
    setNewProduct(null);
    setNewVariation(null);
    setSearchQuery('');
    setSearchResults([]);
    onOpenChange(false);
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Troca de Produto - Pedido #{order.id.slice(0, 8).toUpperCase()}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-2">
          <div className="space-y-4 py-2">
            {/* Step 1: Select item to return */}
            {step === 'select-return' && (
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                  <RotateCcw className="h-4 w-4 text-blue-500" />
                  Selecione o item que está sendo devolvido
                </h4>
                <div className="space-y-2">
                  {items.map((item: any, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectReturnItem(item)}
                      className="w-full flex items-center gap-3 rounded-md border p-3 text-sm hover:bg-muted/50 transition-colors text-left"
                    >
                      <img
                        src={item.image_url || item.imageUrl || '/placeholder.svg'}
                        alt={item.name || 'Produto'}
                        className="h-12 w-12 rounded-md object-cover border bg-muted shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{item.name || item.product_name}</p>
                        {(item.variation_label || item.variation) && (
                          <p className="text-xs text-primary">{item.variation_label || item.variation}</p>
                        )}
                        <p className="text-xs text-muted-foreground">Qtd: {item.quantity || 1} • R$ {Number(item.price).toFixed(2)}</p>
                      </div>
                    </button>
                  ))}
                  {items.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum item disponível para troca</p>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Search and select new product */}
            {step === 'select-new' && (
              <div>
                <div className="mb-3 p-2.5 rounded-md bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                    Devolvendo: {returnItem?.name || returnItem?.product_name}
                    {(returnItem?.variation_label || returnItem?.variation) && ` (${returnItem.variation_label || returnItem.variation})`}
                  </p>
                </div>

                <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-green-500" />
                  Busque o novo produto
                </h4>

                <div className="flex gap-2 mb-3">
                  <Input
                    placeholder="Nome ou código de barras..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  />
                  <Button variant="outline" size="icon" onClick={handleSearch} disabled={searching}>
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>

                <ScrollArea className="max-h-[40vh]">
                  <div className="space-y-2 pr-2">
                  {searchResults.map(product => (
                    <div key={product.id} className="rounded-md border">
                      {product.variations.length > 0 ? (
                        <>
                          <div className="flex items-center gap-3 p-3 text-sm border-b bg-muted/30">
                            <img
                              src={product.image_url || '/placeholder.svg'}
                              alt={product.name}
                              className="h-10 w-10 rounded-md object-cover border bg-muted shrink-0"
                            />
                            <p className="font-medium truncate">{product.name}</p>
                          </div>
                          <div className="p-2 space-y-1">
                            {product.variations.map(v => (
                              <button
                                key={v.id}
                                onClick={() => handleSelectNewProduct(product, v)}
                                className="w-full flex items-center justify-between rounded p-2 text-xs hover:bg-muted/50 transition-colors"
                              >
                                <span className="font-medium">{v.label}</span>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className={`text-[10px] ${v.stock <= 0 ? 'border-destructive text-destructive' : ''}`}>
                                    Est: {v.stock}
                                  </Badge>
                                  <span className="font-medium">R$ {Number(v.price || product.price).toFixed(2)}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </>
                      ) : (
                        <button
                          onClick={() => handleSelectNewProduct(product)}
                          className="w-full flex items-center gap-3 p-3 text-sm hover:bg-muted/50 transition-colors text-left"
                        >
                          <img
                            src={product.image_url || '/placeholder.svg'}
                            alt={product.name}
                            className="h-10 w-10 rounded-md object-cover border bg-muted shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{product.name}</p>
                          </div>
                          <span className="font-medium shrink-0">R$ {Number(product.price).toFixed(2)}</span>
                        </button>
                      )}
                    </div>
                  ))}
                  </div>
                </ScrollArea>

                <Button variant="ghost" size="sm" className="mt-3" onClick={() => { setStep('select-return'); setReturnItem(null); }}>
                  ← Voltar
                </Button>
              </div>
            )}

            {/* Step 3: Confirmation */}
            {step === 'confirm' && returnItem && newProduct && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold">Confirme a troca</h4>

                <div className="p-3 rounded-md border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1 flex items-center gap-1">
                    <RotateCcw className="h-3 w-3" /> Devolvendo (volta ao estoque)
                  </p>
                  <p className="text-sm font-medium">{returnItem.name || returnItem.product_name}</p>
                  {(returnItem.variation_label || returnItem.variation) && (
                    <p className="text-xs text-red-600 dark:text-red-400">{returnItem.variation_label || returnItem.variation}</p>
                  )}
                  <p className="text-xs text-muted-foreground">Qtd: {returnItem.quantity || 1} • R$ {Number(returnItem.price).toFixed(2)}</p>
                </div>

                <div className="flex justify-center">
                  <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
                </div>

                <div className="p-3 rounded-md border border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
                  <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1 flex items-center gap-1">
                    <Package className="h-3 w-3" /> Novo produto (sai do estoque)
                  </p>
                  <p className="text-sm font-medium">{newProduct.name}</p>
                  {newVariation && (
                    <p className="text-xs text-green-600 dark:text-green-400">{newVariation.label}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Qtd: {returnItem.quantity || 1} • R$ {Number(newVariation?.price || newProduct.price).toFixed(2)}
                  </p>
                </div>

                {(() => {
                  const returnPrice = Number(returnItem.price) * (returnItem.quantity || 1);
                  const newPrice = Number(newVariation?.price || newProduct.price) * (returnItem.quantity || 1);
                  const diff = newPrice - returnPrice;
                  if (Math.abs(diff) > 0.01) {
                    return (
                      <>
                        <Separator />
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">Diferença de valor:</span>
                          <span className={`font-bold ${diff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {diff > 0 ? '+' : ''}R$ {diff.toFixed(2)}
                          </span>
                        </div>
                      </>
                    );
                  }
                  return null;
                })()}

                <Button variant="ghost" size="sm" onClick={() => { setStep('select-new'); setNewProduct(null); setNewVariation(null); }}>
                  ← Voltar
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          {step === 'confirm' && (
            <Button onClick={handleConfirmExchange} disabled={processing}>
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <ArrowLeftRight className="h-4 w-4 mr-2" />
                  Confirmar Troca
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrderExchangeModal;
