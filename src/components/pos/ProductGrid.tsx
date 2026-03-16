import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { offlineService } from '@/services/offlineService';
import { cn } from '@/lib/utils';

interface ProductGridProps {
  selectedCategoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  onProductSelect: (product: CachedProduct) => void;
  isOnline: boolean;
}

interface CachedProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  wholesale_price?: number | null;
  exclusive_price?: number | null;
  promotional_price?: number | null;
  stock: number;
  category_id: string | null;
  category_name: string | null;
  image_url: string | null;
  barcode: string | null;
  is_active: boolean;
  is_lagoona?: boolean;
  variations: Array<{
    id: string;
    sku: string | null;
    price: number | null;
    wholesale_price?: number | null;
    exclusive_price?: number | null;
    promotional_price?: number | null;
    stock: number;
    is_active: boolean;
    image_url?: string | null;
    label: string;
  }>;
}

const ProductGrid = ({
  selectedCategoryId,
  onCategoryChange,
  onProductSelect,
  isOnline,
}: ProductGridProps) => {
  const [products, setProducts] = useState<CachedProduct[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadProducts = async () => {
      setIsLoading(true);
      try {
        // Try to update cache if online
        if (isOnline) {
          await offlineService.cacheProducts();
        }
        
        // Load from cache
        const cached = await offlineService.getCachedProducts();
        setProducts(cached);

        // Extract unique categories
        const uniqueCategories = new Map<string, string>();
        cached.forEach((p) => {
          if (p.category_id && p.category_name) {
            uniqueCategories.set(p.category_id, p.category_name);
          }
        });
        setCategories(
          Array.from(uniqueCategories.entries()).map(([id, name]) => ({ id, name }))
        );
      } catch (error) {
        console.error('Error loading products:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProducts();
  }, [isOnline]);

  const filteredProducts = selectedCategoryId
    ? products.filter((p) => p.category_id === selectedCategoryId)
    : products;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Category filter */}
      <div className="p-4 border-b">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2">
            <Button
              variant={selectedCategoryId === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => onCategoryChange(null)}
            >
              Todos
            </Button>
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategoryId === category.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => onCategoryChange(category.id)}
              >
                {category.name}
              </Button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Products grid */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            Carregando produtos...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Nenhum produto encontrado
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-4">
            {filteredProducts.map((product) => {
              const hasStock = product.stock > 0 || product.variations.some((v) => v.stock > 0);
              const minPrice = product.variations.length > 0
                ? Math.min(
                    product.price,
                    ...product.variations
                      .filter((v) => v.price !== null)
                      .map((v) => v.price!)
                  )
                : product.price;

              return (
                <button
                  key={product.id}
                  className={cn(
                    'flex flex-col rounded-lg border bg-card overflow-hidden transition-all',
                    'hover:shadow-md hover:border-primary/50',
                    'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                    !hasStock && 'opacity-50 cursor-not-allowed'
                  )}
                  onClick={() => hasStock && onProductSelect(product)}
                  disabled={!hasStock}
                >
                  <div className="aspect-square relative bg-muted">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                        Sem foto
                      </div>
                    )}
                    {!hasStock && (
                      <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                        <Badge variant="destructive">Sem estoque</Badge>
                      </div>
                    )}
                    {product.stock <= 3 && product.stock > 0 && (
                      <Badge
                        variant="secondary"
                        className="absolute top-1 right-1 text-xs bg-orange-500/90 text-white animate-pulse"
                      >
                        {product.stock} un.
                      </Badge>
                    )}
                  </div>
                  <div className="p-2 flex-1">
                    <div className="text-sm font-medium line-clamp-2 text-left">
                      {product.name}
                    </div>
                    <div className="text-primary font-semibold mt-1">
                      {product.variations.length > 0 ? (
                        <span className="text-xs text-muted-foreground">a partir de </span>
                      ) : null}
                      {formatCurrency(minPrice)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default ProductGrid;
