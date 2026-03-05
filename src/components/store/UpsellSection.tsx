import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ShoppingCart, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
        if (categoryId) {
          const same = candidates.filter(p => p.category_id === categoryId);
          const other = candidates.filter(p => p.category_id !== categoryId);
          candidates = [...same, ...other];
        }
        const enriched = await enrichProductsWithStock(candidates.slice(0, 2));
        setSuggestions(enriched);
        if (enriched.length > 0) setSelectedIds(new Set([enriched[0].id]));
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

  const getPrice = (p: Product) => {
    const promo = p.promotional_price;
    return promo && promo < p.price ? promo : p.price;
  };

  const selectedProducts = suggestions.filter(p => selectedIds.has(p.id));
  const bundleTotal = currentPrice + selectedProducts.reduce((sum, p) => sum + getPrice(p), 0);
  const discountPercent = selectedProducts.length > 0 ? 5 : 0;
  const bundleDiscounted = bundleTotal * (1 - discountPercent / 100);

  const handleBuyTogether = () => {
    addItem({
      id: currentProduct.id, productId: currentProduct.id, name: currentProduct.name,
      price: currentPrice, imageUrl: currentProduct.image_url || undefined,
      stock: currentProduct.stock, quantity: 1,
    });
    selectedProducts.forEach(p => {
      addItem({
        id: p.id, productId: p.id, name: p.name, price: getPrice(p),
        imageUrl: p.image_url || undefined, stock: p.stock, quantity: 1,
      });
    });
    toast.success(`${selectedProducts.length + 1} produtos adicionados ao carrinho!`, {
      action: { label: 'Ver carrinho', onClick: () => window.location.href = '/carrinho' },
    });
  };

  if (isLoading) return null;
  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">Compre junto</span>
        {discountPercent > 0 && selectedProducts.length > 0 && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">-{discountPercent}%</Badge>
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
          const isSelected = selectedIds.has(product.id);
          const price = getPrice(product);
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
                {/* Checkbox */}
                <button
                  onClick={() => toggleSelect(product.id)}
                  className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    isSelected ? 'bg-store-primary border-store-primary' : 'bg-background border-muted-foreground/30'
                  }`}
                >
                  {isSelected && <Check className="h-3 w-3 text-white" />}
                </button>
                {/* Clickable product info → navigates to product page */}
                <Link
                  to={`/produto/${product.id}`}
                  className="flex items-center gap-3 min-w-0 flex-1"
                >
                  <div className="shrink-0 w-10 h-10 rounded-lg overflow-hidden border bg-muted">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs">📦</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium line-clamp-1 hover:text-store-primary transition-colors">{product.name}</p>
                    <p className="text-[10px] text-muted-foreground">Ver detalhes</p>
                  </div>
                </Link>
                <span className="text-xs font-bold text-store-accent shrink-0">{formatPrice(price)}</span>
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
    </div>
  );
};

export default UpsellSection;
