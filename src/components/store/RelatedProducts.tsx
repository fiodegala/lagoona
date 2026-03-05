import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { productsService, Product } from '@/services/products';
import { enrichProductsWithStock } from '@/services/stockService';
import { cn } from '@/lib/utils';

interface RelatedProductsProps {
  currentProductId: string;
  categoryId?: string | null;
  limit?: number;
}

const RelatedProducts = ({ 
  currentProductId, 
  categoryId,
  limit = 8 
}: RelatedProductsProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    const loadRelatedProducts = async () => {
      try {
        setIsLoading(true);
        const allProducts = await productsService.getAll();
        
        // Filter products: same category, active, exclude current
        let related = allProducts.filter(p => 
          p.id !== currentProductId && 
          p.is_active
        );

        // Prioritize same category
        if (categoryId) {
          const sameCategory = related.filter(p => p.category_id === categoryId);
          const otherProducts = related.filter(p => p.category_id !== categoryId);
          related = [...sameCategory, ...otherProducts];
        }

        // Limit results
        const enriched = await enrichProductsWithStock(related.slice(0, limit));
        setProducts(enriched);
      } catch (error) {
        console.error('Error loading related products:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadRelatedProducts();
  }, [currentProductId, categoryId, limit]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const scrollContainer = (direction: 'left' | 'right') => {
    const container = document.getElementById('related-products-container');
    if (!container) return;

    const scrollAmount = 280; // Card width + gap
    const newPosition = direction === 'left' 
      ? Math.max(0, scrollPosition - scrollAmount)
      : scrollPosition + scrollAmount;
    
    container.scrollTo({ left: newPosition, behavior: 'smooth' });
    setScrollPosition(newPosition);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollPosition(e.currentTarget.scrollLeft);
  };

  if (isLoading) {
    return (
      <div className="py-12">
        <h2 className="text-2xl font-display font-bold text-store-accent mb-6">
          Produtos Relacionados
        </h2>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return null;
  }

  const canScrollLeft = scrollPosition > 0;
  const container = document.getElementById('related-products-container');
  const canScrollRight = container 
    ? scrollPosition < container.scrollWidth - container.clientWidth - 10
    : false;

  return (
    <div className="py-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-display font-bold text-store-accent">
          Produtos Relacionados
        </h2>
        
      </div>

      <div className="relative group/carousel">
        {canScrollLeft && (
          <Button
            variant="outline"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 h-9 w-9 rounded-full bg-background/90 backdrop-blur-sm shadow-md opacity-0 group-hover/carousel:opacity-100 transition-opacity hidden md:flex"
            onClick={() => scrollContainer('left')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}

        {canScrollRight && (
          <Button
            variant="outline"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 h-9 w-9 rounded-full bg-background/90 backdrop-blur-sm shadow-md opacity-0 group-hover/carousel:opacity-100 transition-opacity hidden md:flex"
            onClick={() => scrollContainer('right')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}

        <div 
          id="related-products-container"
          className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          onScroll={handleScroll}
        >
        {products.map((product) => {
          const hasDiscount = (product as any).promotional_price != null && (product as any).promotional_price < product.price;
          const discountPercent = hasDiscount
            ? Math.round(((product.price - (product as any).promotional_price) / product.price) * 100)
            : 0;
          const displayPrice = hasDiscount ? (product as any).promotional_price : product.price;

          return (
            <Link
              key={product.id}
              to={`/produto/${product.id}`}
              className="shrink-0 w-[200px] md:w-[240px] snap-start"
            >
              <Card className="group h-full overflow-hidden border hover:border-store-primary/30 transition-all hover:shadow-lg">
                <div className="relative aspect-square overflow-hidden bg-muted">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                      <span className="text-4xl">📦</span>
                    </div>
                  )}
                  
                  {hasDiscount && (
                    <Badge className="absolute top-2 left-2 bg-store-deal text-white text-xs">
                      -{discountPercent}%
                    </Badge>
                  )}

                  {product.stock <= 5 && product.stock > 0 && (
                    <Badge 
                      variant="outline" 
                      className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-warning border-warning text-xs"
                    >
                      Últimas un.
                    </Badge>
                  )}
                </div>

                <CardContent className="p-3">
                  <h3 className="font-medium text-sm line-clamp-2 mb-2 group-hover:text-store-primary transition-colors">
                    {product.name}
                  </h3>
                  
                  <div className="space-y-0.5">
                    {hasDiscount && (
                      <p className="text-xs text-muted-foreground line-through">
                        {formatPrice(product.price)}
                      </p>
                    )}
                    <p className="font-bold text-store-accent">
                      {formatPrice(displayPrice)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ou 6x de {formatPrice(product.price / 6)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
        </div>
      </div>
    </div>
  );
};

export default RelatedProducts;
