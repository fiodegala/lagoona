import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Plus, Minus, Save, Loader2, User, Package, CreditCard, StickyNote, Search, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { posService } from '@/services/posService';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface QuoteItem {
  product_id?: string;
  variation_id?: string;
  name: string;
  sku?: string;
  image_url?: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  total: number;
}

interface QuoteData {
  id: string;
  customer_name: string | null;
  customer_document: string | null;
  customer_phone: string | null;
  items: QuoteItem[];
  subtotal: number;
  discount_amount: number;
  discount_type: string | null;
  discount_value: number | null;
  total: number;
  notes: string | null;
  payment_method: string | null;
  payment_details: Record<string, any> | null;
}

interface QuoteEditModalProps {
  quote: QuoteData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

interface SearchResult {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  barcode: string | null;
  stock: number;
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

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const paymentMethods = [
  { value: 'cash', label: 'Dinheiro' },
  { value: 'card', label: 'Cartão' },
  { value: 'pix', label: 'PIX' },
  { value: 'mixed', label: 'Misto' },
];

const QuoteEditModal = ({ quote, open, onOpenChange, onSaved }: QuoteEditModalProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerDocument, setCustomerDocument] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [cardType, setCardType] = useState<'credit' | 'debit'>('credit');
  const [installments, setInstallments] = useState('1');

  // Product search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [matchedVariationMap, setMatchedVariationMap] = useState<Record<string, string>>({});
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Variation picker state
  const [variationPickerProduct, setVariationPickerProduct] = useState<SearchResult | null>(null);

  useEffect(() => {
    if (quote && open) {
      setCustomerName(quote.customer_name || '');
      setCustomerDocument(quote.customer_document || '');
      setCustomerPhone(quote.customer_phone || '');
      setItems((quote.items || []).map(item => ({ ...item })));
      setNotes(quote.notes || '');
      setPaymentMethod(quote.payment_method || '');
      // Restore card details from payment_details
      const details = quote.payment_details;
      if (details) {
        setCardType((details.cardType as 'credit' | 'debit') || 'credit');
        setInstallments(String(details.installments || '1'));
      } else {
        setCardType('credit');
        setInstallments('1');
      }
      setSearchQuery('');
      setSearchResults([]);
      setShowResults(false);
      setVariationPickerProduct(null);
    }
  }, [quote, open]);

  // Debounced product search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setMatchedVariationMap({});
      return;
    }
    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const result = await posService.searchProducts(searchQuery);
        setMatchedVariationMap(result.matchedVariationMap);
        setSearchResults(
          result.products.map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            image_url: p.image_url,
            barcode: p.barcode,
            stock: p.stock,
            variations: (p.product_variations || []).map((v: Record<string, unknown>) => ({
              id: v.id as string,
              sku: v.sku as string | null,
              price: v.price as number | null,
              stock: v.stock as number,
              is_active: v.is_active as boolean,
              image_url: v.image_url as string | null,
              label: v.label as string | undefined,
            })),
          }))
        );
        setShowResults(true);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const getDisplayInfo = (product: SearchResult) => {
    const matchedVarId = matchedVariationMap[product.id];
    if (matchedVarId) {
      const variation = product.variations.find(v => v.id === matchedVarId);
      if (variation) {
        return {
          image: variation.image_url || product.image_url,
          price: variation.price ?? product.price,
          stock: variation.stock,
          label: variation.label ? `${product.name} — ${variation.label}` : product.name,
          sku: variation.sku,
          variationId: variation.id,
        };
      }
    }
    return {
      image: product.image_url,
      price: product.price,
      stock: product.stock,
      label: product.name,
      sku: null,
      variationId: undefined as string | undefined,
    };
  };

  const handleProductSelected = (product: SearchResult) => {
    const matchedVarId = matchedVariationMap[product.id];
    const activeVariations = product.variations.filter(v => v.is_active);

    // If matched a specific variation via barcode/SKU, add directly
    if (matchedVarId) {
      addItemFromProduct(product, matchedVarId);
    }
    // If product has variations, show picker
    else if (activeVariations.length > 0) {
      setVariationPickerProduct(product);
      setShowResults(false);
      setSearchQuery('');
    }
    // No variations, add directly
    else {
      addItemFromProduct(product);
    }
  };

  const addItemFromProduct = (product: SearchResult, variationId?: string) => {
    let name = product.name;
    let price = product.price;
    let sku: string | undefined;
    let image = product.image_url || undefined;

    if (variationId) {
      const variation = product.variations.find(v => v.id === variationId);
      if (variation) {
        name = variation.label ? `${product.name} — ${variation.label}` : product.name;
        price = variation.price ?? product.price;
        sku = variation.sku || undefined;
        image = variation.image_url || product.image_url || undefined;
      }
    }

    // Check if item already exists
    const existingIdx = items.findIndex(
      i => i.product_id === product.id && i.variation_id === variationId
    );

    if (existingIdx >= 0) {
      updateItemQty(existingIdx, 1);
      toast({ title: 'Quantidade atualizada', description: name });
    } else {
      const newItem: QuoteItem = {
        product_id: product.id,
        variation_id: variationId,
        name,
        sku,
        image_url: image,
        quantity: 1,
        unit_price: price,
        discount_amount: 0,
        total: price,
      };
      setItems(prev => [...prev, newItem]);
      toast({ title: 'Produto adicionado', description: name });
    }

    setSearchQuery('');
    setShowResults(false);
    setVariationPickerProduct(null);
    searchInputRef.current?.focus();
  };

  const updateItemQty = (idx: number, delta: number) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const newQty = Math.max(1, item.quantity + delta);
      const total = newQty * item.unit_price - item.discount_amount;
      return { ...item, quantity: newQty, total: Math.max(0, total) };
    }));
  };

  const updateItemPrice = (idx: number, price: number) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const total = item.quantity * price - item.discount_amount;
      return { ...item, unit_price: price, total: Math.max(0, total) };
    }));
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) {
      toast({ title: 'O orçamento precisa ter pelo menos 1 item', variant: 'destructive' });
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const itemDiscounts = items.reduce((sum, item) => sum + (item.discount_amount || 0), 0);
  const total = subtotal - itemDiscounts;

  const handleSave = async () => {
    if (!quote) return;
    if (items.length === 0) {
      toast({ title: 'Adicione pelo menos 1 item', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const updatedItems = items.map(item => ({
        ...item,
        total: item.quantity * item.unit_price - (item.discount_amount || 0),
      }));

      // Build payment_details for card
      let paymentDetails: Record<string, unknown> | null = null;
      if (paymentMethod === 'card') {
        paymentDetails = {
          cardType,
          installments: cardType === 'credit' ? parseInt(installments) : 1,
          installmentValue: cardType === 'credit' ? total / parseInt(installments) : total,
        };
      }

      const { error } = await supabase
        .from('quotes')
        .update({
          customer_name: customerName.trim() || null,
          customer_document: customerDocument.trim() || null,
          customer_phone: customerPhone.trim() || null,
          items: updatedItems as unknown as Record<string, unknown>[],
          subtotal,
          discount_amount: itemDiscounts,
          total,
          notes: notes.trim() || null,
          payment_method: paymentMethod || null,
          payment_details: paymentDetails || {},
        } as never)
        .eq('id', quote.id);

      if (error) throw error;

      toast({ title: 'Orçamento atualizado!' });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!quote) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            Editar Orçamento #{quote.id.slice(0, 8).toUpperCase()}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-6 py-2 px-1">
          {/* Cliente */}
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              Dados do Cliente
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-name">Nome</Label>
                <Input id="edit-name" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nome do cliente" maxLength={200} />
              </div>
              <div>
                <Label htmlFor="edit-doc">CPF/CNPJ</Label>
                <Input id="edit-doc" value={customerDocument} onChange={e => setCustomerDocument(e.target.value)} placeholder="Documento" maxLength={20} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="edit-phone">Telefone</Label>
                <Input id="edit-phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="(00) 00000-0000" maxLength={20} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Itens */}
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-muted-foreground" />
              Itens ({items.length})
            </h4>

            {/* Product Search */}
            <div className="relative mb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar produto por nome, SKU ou código de barras..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchQuery && setShowResults(true)}
                  className="pl-10 pr-10"
                />
                {searchQuery && (
                  <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => { setSearchQuery(''); setSearchResults([]); searchInputRef.current?.focus(); }}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {showResults && (searchQuery || searchResults.length > 0) && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 max-h-60 overflow-auto">
                  {isSearching ? (
                    <div className="p-3 flex items-center justify-center gap-2 text-muted-foreground text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="py-1">
                      {searchResults.map((product) => {
                        const display = getDisplayInfo(product);
                        return (
                          <button
                            key={`${product.id}-${display.variationId || ''}`}
                            className={cn('w-full px-3 py-2 flex items-center gap-3 hover:bg-accent text-left', display.stock <= 0 && !product.variations.length && 'opacity-50')}
                            onClick={() => handleProductSelected(product)}
                          >
                            {display.image ? (
                              <img src={display.image} alt={display.label} className="h-10 w-10 object-cover rounded border bg-muted" />
                            ) : (
                              <div className="h-10 w-10 bg-muted rounded flex items-center justify-center text-muted-foreground text-[10px]">Sem foto</div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{display.label}</p>
                              {display.sku && <p className="text-xs text-muted-foreground font-mono">{display.sku}</p>}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-semibold text-primary">{formatCurrency(display.price)}</p>
                              <p className={cn('text-xs', display.stock <= 0 ? 'text-destructive' : 'text-muted-foreground')}>
                                {product.variations.length > 0 && !display.variationId ? `${product.variations.filter(v => v.is_active).length} variações` : display.stock <= 0 ? 'Sem estoque' : `${display.stock} disp.`}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : searchQuery ? (
                    <div className="p-3 text-center text-muted-foreground text-sm">Nenhum produto encontrado</div>
                  ) : null}
                </div>
              )}

              {showResults && <div className="fixed inset-0 z-40" onClick={() => setShowResults(false)} />}
            </div>

            {/* Variation Picker Inline */}
            {variationPickerProduct && (
              <div className="mb-3 border rounded-lg p-3 bg-muted/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {variationPickerProduct.image_url && (
                      <img src={variationPickerProduct.image_url} alt={variationPickerProduct.name} className="w-8 h-8 rounded object-cover" />
                    )}
                    <span className="text-sm font-semibold truncate">{variationPickerProduct.name}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setVariationPickerProduct(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Selecione a variação:</p>
                <ScrollArea className="max-h-48">
                  <div className="space-y-1.5">
                    {variationPickerProduct.variations.filter(v => v.is_active).map((variation) => {
                      const hasStock = variation.stock > 0;
                      const price = variation.price ?? variationPickerProduct.price;
                      return (
                        <button
                          key={variation.id}
                          className={cn(
                            'w-full flex items-center justify-between p-2.5 rounded-md border transition-all text-left text-sm',
                            hasStock ? 'hover:border-primary/50 hover:bg-accent cursor-pointer' : 'opacity-50 cursor-not-allowed'
                          )}
                          onClick={() => hasStock && addItemFromProduct(variationPickerProduct, variation.id)}
                          disabled={!hasStock}
                        >
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">{variation.label || variation.sku || variation.id.slice(0, 8)}</span>
                            {variation.sku && variation.label && (
                              <span className="text-xs text-muted-foreground ml-2">SKU: {variation.sku}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <Badge
                              variant={hasStock ? (variation.stock <= 3 ? 'secondary' : 'outline') : 'destructive'}
                              className={cn('text-xs', variation.stock <= 3 && hasStock && 'bg-orange-500/20 text-orange-700 border-orange-500/30')}
                            >
                              {hasStock ? `${variation.stock} un.` : 'Sem estoque'}
                            </Badge>
                            <span className="font-semibold text-primary whitespace-nowrap">{formatCurrency(price)}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 rounded-lg border p-3 bg-background">
                  <img src={item.image_url || '/placeholder.svg'} alt={item.name} className="h-12 w-12 rounded-md object-cover shrink-0 border bg-muted" />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    {item.sku && <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Label className="text-xs text-muted-foreground">Preço:</Label>
                        <Input type="number" step="0.01" min="0" value={item.unit_price} onChange={e => updateItemPrice(idx, parseFloat(e.target.value) || 0)} className="h-7 w-24 text-xs" />
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateItemQty(idx, -1)}><Minus className="h-3 w-3" /></Button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateItemQty(idx, 1)}><Plus className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <p className="text-sm font-bold">{formatCurrency(item.quantity * item.unit_price)}</p>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(idx)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Totais */}
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {itemDiscounts > 0 && (
              <div className="flex justify-between text-destructive">
                <span>Descontos nos itens</span>
                <span>-{formatCurrency(itemDiscounts)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(total)}</span>
            </div>
          </div>

          <Separator />

          {/* Pagamento */}
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
              Forma de Pagamento
            </h4>
            <Select value={paymentMethod} onValueChange={(v) => { setPaymentMethod(v); if (v !== 'card') { setCardType('credit'); setInstallments('1'); } }}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map(pm => (
                  <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Card details */}
            {paymentMethod === 'card' && (
              <div className="mt-3 space-y-3 pl-1">
                <div className="space-y-2">
                  <Label className="text-xs">Tipo de Cartão</Label>
                  <RadioGroup
                    value={cardType}
                    onValueChange={(v) => { setCardType(v as 'credit' | 'debit'); if (v === 'debit') setInstallments('1'); }}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="credit" id="q-credit" />
                      <Label htmlFor="q-credit" className="cursor-pointer font-normal text-sm">Crédito</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="debit" id="q-debit" />
                      <Label htmlFor="q-debit" className="cursor-pointer font-normal text-sm">Débito</Label>
                    </div>
                  </RadioGroup>
                </div>

                {cardType === 'credit' && (
                  <div className="space-y-2">
                    <Label className="text-xs">Parcelas</Label>
                    <Select value={installments} onValueChange={setInstallments}>
                      <SelectTrigger className="w-full sm:w-64">
                        <SelectValue placeholder="Selecione as parcelas" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 6 }, (_, i) => i + 1).map((num) => {
                          const value = total / num;
                          return (
                            <SelectItem key={num} value={num.toString()}>
                              {num}x de {formatCurrency(value)}{num === 1 && ' (à vista)'}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {parseInt(installments) > 1 && (
                      <p className="text-xs text-muted-foreground">
                        {installments}x de <span className="font-semibold text-primary">{formatCurrency(total / parseInt(installments))}</span>
                      </p>
                    )}
                  </div>
                )}

                {cardType === 'debit' && (
                  <p className="text-xs text-muted-foreground">Débito à vista — {formatCurrency(total)}</p>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Observações */}
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
              Observações
            </h4>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações do orçamento..." rows={3} maxLength={1000} />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuoteEditModal;
