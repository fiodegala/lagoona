import { useState, useEffect, useCallback } from 'react';
import { Plus, ShoppingCart, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { productsService, Product } from '@/services/products';
import { variationsService, ProductVariation } from '@/services/variations';
import { enrichProductsWithStock } from '@/services/stockService';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface UpsellSectionProps {
  currentProduct: Product;
  currentPrice: number;
  currentVariation?: ProductVariation | null;
  categoryId?: string | null;
}

interface SelectedUpsellItem {
  product: Product;
  variation?: ProductVariation;
  price: number;
}

interface UpsellRule {
  upsell_product_id: string;
  discount_percent: number;
  sort_order: number;
}

const UpsellSection = ({ currentProduct, currentPrice, currentVariation, categoryId }: UpsellSectionProps) => {
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [discountPercent, setDiscountPercent] = useState(5);
  const [selectedItems, setSelectedItems] = useState<Map<string, SelectedUpsellItem>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const { addItem } = useCart();

  // Variation picker state
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [pickerVariations, setPickerVariations] = useState<ProductVariation[]>([]);
  const [pickerAttributes, setPickerAttributes] = useState<{ name: string; values: string[] }[]>([]);
  const [pickerSelectedValues, setPickerSelectedValues] = useState<Record<string, string>>({});
  const [pickerStockMap, setPickerStockMap] = useState<Record<string, number>>({});
  const [pickerLoading, setPickerLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);

        // Try to load configured upsells first
        const { data: upsellRules } = await supabase
          .from('product_upsells')
          .select('upsell_product_id, discount_percent, sort_order')
          .eq('product_id', currentProduct.id)
          .eq('is_active', true)
          .order('sort_order');

        if (upsellRules && upsellRules.length > 0) {
          // Use configured upsells
          const avgDiscount = upsellRules.reduce((s, r) => s + Number(r.discount_percent), 0) / upsellRules.length;
          setDiscountPercent(avgDiscount);

          const all = await productsService.getAll();
          const productMap = new Map(all.map(p => [p.id, p]));
          const configured = upsellRules
            .map(r => productMap.get(r.upsell_product_id))
            .filter((p): p is Product => !!p && p.is_active);

          const enriched = await enrichProductsWithStock(configured.slice(0, 3));
          setSuggestions(enriched.filter(p => p.stock > 0));
        } else {
          // Fallback: auto-suggest from same category
          setDiscountPercent(5);
          const all = await productsService.getAll();
          let candidates = all.filter(p => p.id !== currentProduct.id && p.is_active);
          if (categoryId) {
            const same = candidates.filter(p => p.category_id === categoryId);
            const other = candidates.filter(p => p.category_id !== categoryId);
            candidates = [...same, ...other];
          }
          const enriched = await enrichProductsWithStock(candidates.slice(0, 4));
          setSuggestions(enriched.filter(p => p.stock > 0).slice(0, 2));
        }
      } catch (err) {
        console.error('Error loading upsell:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [currentProduct.id, categoryId]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

  const getPrice = (p: Product) => {
    const promo = p.promotional_price;
    return promo && promo < p.price ? promo : p.price;
  };

  const selectedProducts = Array.from(selectedItems.values());
  const bundleTotal = currentPrice + selectedProducts.reduce((sum, item) => sum + item.price, 0);
  const effectiveDiscount = selectedProducts.length > 0 ? discountPercent : 0;
  const bundleDiscounted = bundleTotal * (1 - effectiveDiscount / 100);

  // Open variation picker for a product
  const openPicker = async (product: Product) => {
    setPickerProduct(product);
    setPickerLoading(true);
    setPickerSelectedValues({});
    try {
      const [attrs, vars, stockRes] = await Promise.all([
        variationsService.getAttributesByProduct(product.id),
        variationsService.getVariationsByProduct(product.id),
        supabase
          .from('store_stock')
          .select('variation_id, quantity')
          .eq('product_id', product.id)
          .not('variation_id', 'is', null),
      ]);

      const activeVars = vars.filter(v => v.is_active);

      if (activeVars.length === 0) {
        // No variations — select product directly
        toggleProduct(product);
        setPickerProduct(null);
        return;
      }

      const map: Record<string, number> = {};
      (stockRes.data || []).forEach((row: any) => {
        if (row.variation_id) {
          map[row.variation_id] = (map[row.variation_id] || 0) + row.quantity;
        }
      });

      setPickerVariations(activeVars);
      setPickerStockMap(map);

      // Build attribute groups
      const attrGroups = attrs
        .filter(a => a.values && a.values.length > 0)
        .map(a => ({
          name: a.name,
          values: a.values!.map(v => v.value),
        }));
      setPickerAttributes(attrGroups);
    } catch (err) {
      console.error('Error loading variations:', err);
      toast.error('Erro ao carregar variações');
      setPickerProduct(null);
    } finally {
      setPickerLoading(false);
    }
  };

  const toggleProduct = (product: Product, variation?: ProductVariation) => {
    setSelectedItems(prev => {
      const next = new Map(prev);
      const key = product.id;
      if (next.has(key)) {
        next.delete(key);
      } else {
        const price = variation?.price ?? getPrice(product);
        next.set(key, { product, variation, price });
      }
      return next;
    });
  };

  const handlePickerValueSelect = (attrName: string, value: string) => {
    setPickerSelectedValues(prev => ({
      ...prev,
      [attrName]: prev[attrName] === value ? '' : value,
    }));
  };

  const pickerMatchedVariation = pickerVariations.find(v =>
    v.attribute_values?.every(av => pickerSelectedValues[av.attribute_name] === av.value)
  );

  const confirmVariation = () => {
    if (!pickerProduct || !pickerMatchedVariation) return;
    const realStock = pickerStockMap[pickerMatchedVariation.id] ?? pickerMatchedVariation.stock;
    const enrichedVar = { ...pickerMatchedVariation, stock: realStock };
    const price = enrichedVar.price ?? getPrice(pickerProduct);

    setSelectedItems(prev => {
      const next = new Map(prev);
      next.set(pickerProduct.id, { product: pickerProduct, variation: enrichedVar, price });
      return next;
    });
    setPickerProduct(null);
  };

  const handleBuyTogether = () => {
    const discountMultiplier = 1 - discountPercent / 100;
    addItem({
      id: currentProduct.id, productId: currentProduct.id, name: currentProduct.name,
      price: currentPrice * discountMultiplier, imageUrl: currentProduct.image_url || undefined,
      stock: currentProduct.stock, quantity: 1,
    });
    selectedProducts.forEach(({ product, variation, price }) => {
      const variationLabel = variation?.attribute_values?.map(av => av.value).join(' / ');
      const discountedPrice = price * discountMultiplier;
      addItem({
        id: variation?.id || product.id,
        productId: product.id,
        name: variationLabel ? `${product.name} - ${variationLabel}` : product.name,
        price: discountedPrice,
        imageUrl: variation?.image_url || product.image_url || undefined,
        stock: variation?.stock ?? product.stock,
        quantity: 1,
      });
    });
    toast.success(`${selectedProducts.length + 1} produtos adicionados ao carrinho com ${discountPercent}% de desconto!`, {
      action: { label: 'Ver carrinho', onClick: () => window.location.href = '/carrinho' },
    });
  };

  if (isLoading) return null;
  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">Compre junto</span>
        {effectiveDiscount > 0 && selectedProducts.length > 0 && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">-{effectiveDiscount}%</Badge>
        )}
      </div>

      <div className="rounded-xl border bg-card p-3 space-y-2">
        {/* Current product row */}
        <div className="flex items-center gap-3">
          <div className="shrink-0 w-10 h-10 rounded-lg overflow-hidden border bg-muted">
            {currentProduct.image_url ? (
              <img src={currentProduct.image_url} alt={currentProduct.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs">📦</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium line-clamp-1">{currentProduct.name}</p>
            <p className="text-xs text-muted-foreground">Este produto</p>
          </div>
          <span className="text-xs font-bold text-store-accent shrink-0">{formatPrice(currentPrice)}</span>
        </div>

        {/* Suggestion rows */}
        {suggestions.map((product) => {
          const isSelected = selectedItems.has(product.id);
          const selectedItem = selectedItems.get(product.id);
          const price = selectedItem?.price ?? getPrice(product);
          const variationLabel = selectedItem?.variation?.attribute_values?.map(av => av.value).join(' / ');

          return (
            <div key={product.id}>
              <div className="flex items-center gap-2 py-0.5">
                <div className="flex-1 h-px bg-border" />
                <Plus className="h-3 w-3 text-muted-foreground shrink-0" />
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className={`w-full flex items-center gap-3 p-1.5 rounded-lg transition-all ${
                isSelected ? 'bg-store-primary/5 ring-1 ring-store-primary' : 'hover:bg-muted/50'
              }`}>
                {/* Checkbox toggle */}
                <button
                  onClick={() => {
                    if (isSelected) {
                      setSelectedItems(prev => { const n = new Map(prev); n.delete(product.id); return n; });
                    } else {
                      openPicker(product);
                    }
                  }}
                  className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    isSelected ? 'bg-store-primary border-store-primary' : 'bg-background border-muted-foreground/30'
                  }`}
                >
                  {isSelected && <Check className="h-3 w-3 text-white" />}
                </button>
                {/* Product info — click opens picker */}
                <button
                  onClick={() => openPicker(product)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                  <div className="shrink-0 w-10 h-10 rounded-lg overflow-hidden border bg-muted">
                    {(selectedItem?.variation?.image_url || product.image_url) ? (
                      <img src={selectedItem?.variation?.image_url || product.image_url!} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs">📦</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium line-clamp-1 hover:text-store-primary transition-colors">{product.name}</p>
                    {variationLabel ? (
                      <p className="text-[10px] text-store-primary font-medium">{variationLabel}</p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">Selecionar variação</p>
                    )}
                  </div>
                </button>
                <div className="text-right shrink-0">
                  {discountPercent > 0 ? (
                    <>
                      <p className="text-[10px] text-muted-foreground line-through">{formatPrice(price)}</p>
                      <p className="text-xs font-bold text-green-600">{formatPrice(price * (1 - discountPercent / 100))}</p>
                    </>
                  ) : (
                    <span className="text-xs font-bold text-store-accent">{formatPrice(price)}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Total + CTA */}
        {selectedProducts.length > 0 && (
          <div className="flex items-center justify-between gap-3 pt-2 border-t">
            <div>
              <p className="text-[10px] text-muted-foreground line-through">{formatPrice(bundleTotal)}</p>
              <p className="text-sm font-bold text-store-accent">{formatPrice(bundleDiscounted)}</p>
            </div>
            <Button
              size="sm"
              onClick={handleBuyTogether}
              className="gap-1.5 bg-store-primary text-store-accent hover:bg-store-primary/90 text-xs h-8"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              Comprar junto
            </Button>
          </div>
        )}
      </div>

      {/* Variation Picker Dialog */}
      <Dialog open={!!pickerProduct} onOpenChange={(open) => !open && setPickerProduct(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Selecione a variação</DialogTitle>
          </DialogHeader>
          {pickerProduct && (
            <div className="space-y-4">
              {/* Product preview */}
              <div className="flex items-center gap-3">
                <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden border bg-muted">
                  {pickerProduct.image_url ? (
                    <img src={pickerProduct.image_url} alt={pickerProduct.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">📦</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium line-clamp-2">{pickerProduct.name}</p>
                  <p className="text-sm font-bold text-store-accent">{formatPrice(getPrice(pickerProduct))}</p>
                </div>
              </div>

              {pickerLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                </div>
              ) : (
                <>
                  {/* Attribute selectors */}
                  {pickerAttributes.map(attr => (
                    <div key={attr.name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{attr.name}:</span>
                        {pickerSelectedValues[attr.name] && (
                          <span className="text-xs text-muted-foreground">{pickerSelectedValues[attr.name]}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {attr.values.map(val => {
                          const isSelected = pickerSelectedValues[attr.name] === val;
                          // Check stock considering other selected attributes
                          const hasStock = pickerVariations.some(v => {
                            const hasThisValue = v.attribute_values?.some(av => av.attribute_name === attr.name && av.value === val);
                            if (!hasThisValue) return false;
                            // Check if this variation is compatible with other selected attributes
                            const compatibleWithOtherSelections = Object.entries(pickerSelectedValues).every(([selName, selVal]) => {
                              if (selName === attr.name || !selVal) return true;
                              return v.attribute_values?.some(av => av.attribute_name === selName && av.value === selVal);
                            });
                            if (!compatibleWithOtherSelections) return false;
                            return (pickerStockMap[v.id] ?? v.stock) > 0;
                          });
                          return (
                            <Button
                              key={val}
                              variant={isSelected ? 'default' : 'outline'}
                              size="sm"
                              disabled={!hasStock}
                              onClick={() => handlePickerValueSelect(attr.name, val)}
                              className={cn(
                                'min-w-[50px] text-xs relative',
                                isSelected && 'bg-store-primary text-store-accent hover:bg-store-primary/90',
                                !hasStock && 'opacity-50 line-through'
                              )}
                            >
                              {val}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Matched variation info */}
                  {pickerMatchedVariation && (
                    <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
                      Estoque: {pickerStockMap[pickerMatchedVariation.id] || 0} un.
                      {pickerMatchedVariation.price && (
                        <> · Preço: {formatPrice(pickerMatchedVariation.price)}</>
                      )}
                    </div>
                  )}

                  {/* Confirm button */}
                  <Button
                    onClick={confirmVariation}
                    disabled={!pickerMatchedVariation}
                    className="w-full gap-2 bg-store-primary text-store-accent hover:bg-store-primary/90"
                  >
                    <Check className="h-4 w-4" />
                    Confirmar variação
                  </Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UpsellSection;
