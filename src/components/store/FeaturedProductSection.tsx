import { useState, useCallback, useMemo } from 'react';
import { getOptimizedImageUrl } from '@/lib/imageUtils';
import { Link } from 'react-router-dom';
import { ShoppingCart, Minus, Plus, Eye, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ProductVariationSelector from './ProductVariationSelector';
import { Product } from '@/services/products';
import { ProductVariation } from '@/services/variations';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';

interface FeaturedProductSectionProps {
  product: Product;
}

const formatPrice = (price: number) =>
  price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const FeaturedProductSection = ({ product }: FeaturedProductSectionProps) => {
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [currentImage, setCurrentImage] = useState(product.image_url);
  const { addItem } = useCart();

  const handleVariationSelect = useCallback((variation: ProductVariation | null) => {
    setSelectedVariation(variation);
    if (variation?.image_url) {
      setCurrentImage(variation.image_url);
    } else {
      setCurrentImage(product.image_url);
    }
  }, [product.image_url]);

  const basePrice = selectedVariation?.price ?? product.price;
  const promotionalPrice = selectedVariation?.promotional_price ?? (product as any).promotional_price ?? null;
  const currentPrice = promotionalPrice && promotionalPrice < basePrice ? promotionalPrice : basePrice;
  const hasDiscount = promotionalPrice !== null && promotionalPrice < basePrice;
  const discountPercent = hasDiscount ? Math.round(((basePrice - promotionalPrice) / basePrice) * 100) : 0;
  const currentStock = selectedVariation?.stock ?? product.stock ?? 0;
  const isOutOfStock = currentStock <= 0;

  const handleAddToCart = () => {
    if (isOutOfStock) {
      toast.error('Produto fora de estoque');
      return;
    }

    const variationLabel = selectedVariation?.attribute_values
      ?.map(av => av.value).join(' / ');

    addItem({
      id: selectedVariation?.id || product.id,
      productId: product.id,
      variationId: selectedVariation?.id,
      name: product.name,
      variationLabel: variationLabel || undefined,
      price: currentPrice,
      imageUrl: currentImage || undefined,
      stock: currentStock,
      quantity,
    });

    toast.success('Produto adicionado ao carrinho!', {
      action: {
        label: 'Ver carrinho',
        onClick: () => window.location.href = '/carrinho',
      },
    });
  };

  return (
    <section className="py-16 md:py-20 bg-gradient-to-br from-store-gold/10 via-store-gold/5 to-transparent border-y border-store-gold/15">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-display font-bold italic">Produto em Destaque</h2>
          <div className="w-12 h-0.5 bg-store-gold mt-2 mx-auto" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 max-w-5xl mx-auto">
          {/* Image */}
          <div className="relative group">
            <Link to={`/produto/${product.id}`} className="block">
              <div className="aspect-[3/4] rounded-xl overflow-hidden bg-muted">
                {currentImage ? (
                  <img
                    src={getOptimizedImageUrl(currentImage, { width: 800, quality: 80 })}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    Sem imagem
                  </div>
                )}
              </div>
            </Link>
            {hasDiscount && (
              <Badge className="absolute top-3 left-3 bg-store-deal text-white font-bold text-sm px-3 py-1">
                -{discountPercent}%
              </Badge>
            )}
          </div>

          {/* Details */}
          <div className="flex flex-col justify-center space-y-5">
            <Link to={`/produto/${product.id}`} className="hover:underline">
              <h3 className="text-xl md:text-2xl font-display font-bold">{product.name}</h3>
            </Link>

            {product.description && (
              <p className="text-muted-foreground text-sm line-clamp-3">{product.description}</p>
            )}

            {/* Price */}
            <div className="space-y-1">
              {hasDiscount && (
                <span className="text-sm text-muted-foreground line-through">{formatPrice(basePrice)}</span>
              )}
              <div className="flex items-baseline gap-2">
                <span className="text-2xl md:text-3xl font-bold text-store-gold">{formatPrice(currentPrice)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                em até 6x de {formatPrice(currentPrice / 6)} sem juros
              </p>
            </div>

            {/* Variation Selector */}
            <ProductVariationSelector
              productId={product.id}
              onVariationSelect={handleVariationSelect}
            />

            {/* Quantity + Add to Cart */}
            <div className="flex items-center gap-4 pt-2">
              <div className="flex items-center border rounded-lg">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  disabled={isOutOfStock}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-10 text-center font-medium">{quantity}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => setQuantity(q => Math.min(q + 1, currentStock))}
                  disabled={isOutOfStock}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <Button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className="flex-1 gap-2 bg-store-gold text-store-dark hover:bg-store-gold/90 font-semibold h-11"
              >
                <ShoppingCart className="h-4 w-4" />
                {isOutOfStock ? 'Esgotado' : 'Compra Rápida'}
              </Button>
            </div>

            {currentStock > 0 && currentStock <= 3 && (
              <p className="text-xs text-store-deal font-medium animate-pulse">
                🔥 Apenas {currentStock} unidade{currentStock > 1 ? 's' : ''} restante{currentStock > 1 ? 's' : ''}!
              </p>
            )}

            <Link
              to={`/produto/${product.id}`}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Eye className="h-4 w-4" />
              Ver detalhes completos
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeaturedProductSection;
