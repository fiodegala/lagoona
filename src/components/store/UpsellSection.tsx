import { useState, useEffect } from 'react';
import { Plus, ShoppingCart, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
        const enriched = await enrichProductsWithStock(candidates.slice(0, 3));
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
      id: currentProduct.id,
      productId: currentProduct.id,
      name: currentProduct.name,
      price: currentPrice,
      imageUrl: currentProduct.image_url || undefined,
      stock: currentProduct.stock,
      quantity: 1,
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

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {/* Current product thumbnail */}
        <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 border-store-primary bg-muted">
          {currentProduct.image_url ? (
            <img src={currentProduct.image_url} alt={currentProduct.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm">📦</div>
          )}
        </div>

        {suggestions.map((product) => {
          const isSelected = selectedIds.has(product.id);
          return (
            <div key={product.id} className="contents">
              <Plus className="h-3 w-3 text-muted-foreground shrink-0" />
              <button
                onClick={() => toggleSelect(product.id)}
                className={`shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all relative ${
                  isSelected ? 'border-store-primary' : 'border-transparent hover:border-muted-foreground/30'
                }`}
              >
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center text-sm">📦</div>
                )}
                {isSelected && (
                  <div className="absolute inset-0 bg-store-primary/20 flex items-center justify-center">
                    <Check className="h-3 w-3 text-store-primary" />
                  </div>
                )}
              </button>
            </div>
          );
        })}

        {/* Divider + Price + CTA */}
        {selectedProducts.length > 0 && (
          <>
            <div className="h-10 w-px bg-border shrink-0 mx-1" />
            <div className="shrink-0 flex items-center gap-2">
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground line-through leading-none">{formatPrice(bundleTotal)}</p>
                <p className="text-sm font-bold text-store-accent leading-tight">{formatPrice(bundleDiscounted)}</p>
              </div>
              <Button
                size="sm"
                onClick={handleBuyTogether}
                className="gap-1 bg-store-primary text-store-accent hover:bg-store-primary/90 text-xs h-8 px-3"
              >
                <ShoppingCart className="h-3 w-3" />
                Comprar
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default UpsellSection;
