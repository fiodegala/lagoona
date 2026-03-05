import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ShoppingCart, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { productsService, Product } from '@/services/products';
import { enrichProductsWithStock } from '@/services/stockService';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';

interface UpsellSectionProps {
  currentProduct: Product;
  currentPrice: number;
  categoryId?: string | null;
}

const UpsellSection = ({ currentProduct, currentPrice, categoryId }: UpsellSectionProps) => {
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const { addItem } = useCart();

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const all = await productsService.getAll();
        let candidates = all.filter(p => p.id !== currentProduct.id && p.is_active && p.stock > 0);

        // Prioritize same category, then others
        if (categoryId) {
          const same = candidates.filter(p => p.category_id === categoryId);
          const other = candidates.filter(p => p.category_id !== categoryId);
          candidates = [...same, ...other];
        }

        const enriched = await enrichProductsWithStock(candidates.slice(0, 3));
        setSuggestions(enriched);
        // Pre-select the first suggestion
        if (enriched.length > 0) {
          setSelectedIds(new Set([enriched[0].id]));
        }
      } catch (err) {
        console.error('Error loading upsell:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [currentProduct.id, categoryId]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

  const selectedProducts = suggestions.filter(p => selectedIds.has(p.id));
  const bundleTotal = currentPrice + selectedProducts.reduce((sum, p) => {
    const promo = p.promotional_price;
    return sum + (promo && promo < p.price ? promo : p.price);
  }, 0);

  // 5% discount for buying together
  const discountPercent = selectedProducts.length > 0 ? 5 : 0;
  const bundleDiscounted = bundleTotal * (1 - discountPercent / 100);

  const handleBuyTogether = () => {
    // Add current product
    addItem({
      id: currentProduct.id,
      productId: currentProduct.id,
      name: currentProduct.name,
      price: currentPrice,
      imageUrl: currentProduct.image_url || undefined,
      stock: currentProduct.stock,
      quantity: 1,
    });

    // Add selected products
    selectedProducts.forEach(p => {
      const promo = p.promotional_price;
      const price = promo && promo < p.price ? promo : p.price;
      addItem({
        id: p.id,
        productId: p.id,
        name: p.name,
        price,
        imageUrl: p.image_url || undefined,
        stock: p.stock,
        quantity: 1,
      });
    });

    toast.success(`${selectedProducts.length + 1} produtos adicionados ao carrinho!`, {
      action: {
        label: 'Ver carrinho',
        onClick: () => window.location.href = '/carrinho',
      },
    });
  };

  if (isLoading) {
    return (
      <div className="py-8">
        <h2 className="text-xl font-display font-bold text-store-accent mb-4">Compre Junto</h2>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <div className="py-8">
      <div className="flex items-center gap-2 mb-6">
        <h2 className="text-xl md:text-2xl font-display font-bold text-store-accent">
          Compre Junto
        </h2>
        <Badge variant="secondary" className="text-xs">Economize {discountPercent}%</Badge>
      </div>

      <div className="rounded-2xl border bg-card p-4 md:p-6">
        <div className="flex flex-col lg:flex-row items-center gap-4">
          {/* Current product */}
          <div className="flex flex-col items-center text-center w-full lg:w-auto lg:min-w-[160px]">
            <div className="w-24 h-24 md:w-28 md:h-28 rounded-xl overflow-hidden border bg-muted mb-2">
              {currentProduct.image_url ? (
                <img src={currentProduct.image_url} alt={currentProduct.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>
              )}
            </div>
            <p className="text-xs font-medium line-clamp-2 max-w-[140px]">{currentProduct.name}</p>
            <p className="text-sm font-bold text-store-accent mt-1">{formatPrice(currentPrice)}</p>
            <Badge variant="outline" className="text-[10px] mt-1">Este produto</Badge>
          </div>

          {/* Suggestions */}
          {suggestions.map((product) => {
            const promo = product.promotional_price;
            const price = promo && promo < product.price ? promo : product.price;
            const isSelected = selectedIds.has(product.id);

            return (
              <div key={product.id} className="contents">
                <div className="flex items-center justify-center lg:px-2">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>

                <button
                  onClick={() => toggleSelect(product.id)}
                  className={`flex flex-col items-center text-center w-full lg:w-auto lg:min-w-[160px] p-3 rounded-xl transition-all cursor-pointer ${
                    isSelected
                      ? 'ring-2 ring-store-primary bg-store-primary/5'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="relative w-24 h-24 md:w-28 md:h-28 rounded-xl overflow-hidden border bg-muted mb-2">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>
                    )}
                    <div className={`absolute top-1 right-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      isSelected ? 'bg-store-primary border-store-primary' : 'bg-background border-muted-foreground/30'
                    }`}>
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                  </div>
                  <p className="text-xs font-medium line-clamp-2 max-w-[140px]">{product.name}</p>
                  <p className="text-sm font-bold text-store-accent mt-1">{formatPrice(price)}</p>
                </button>
              </div>
            );
          })}

          {/* Total + CTA */}
          <div className="w-full lg:w-auto lg:min-w-[200px] flex flex-col items-center lg:items-start gap-3 pt-4 lg:pt-0 lg:pl-4 border-t lg:border-t-0 lg:border-l">
            {selectedProducts.length > 0 && (
              <>
                <div className="text-center lg:text-left">
                  <p className="text-xs text-muted-foreground">
                    {selectedProducts.length + 1} produtos por
                  </p>
                  <p className="text-sm text-muted-foreground line-through">
                    {formatPrice(bundleTotal)}
                  </p>
                  <p className="text-2xl font-bold text-store-accent">
                    {formatPrice(bundleDiscounted)}
                  </p>
                  <p className="text-xs text-success font-medium">
                    Economia de {formatPrice(bundleTotal - bundleDiscounted)}
                  </p>
                </div>
                <Button
                  onClick={handleBuyTogether}
                  className="w-full gap-2 bg-store-primary text-store-accent hover:bg-store-primary/90 font-semibold"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Comprar Junto
                </Button>
              </>
            )}
            {selectedProducts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center">
                Selecione produtos para comprar junto
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpsellSection;
