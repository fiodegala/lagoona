import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, ShoppingCart, Heart, Star, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/contexts/CartContext';
import { useFavorites } from '@/contexts/FavoritesContext';
import { toast } from 'sonner';
import { Product } from '@/services/products';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
  showDiscount?: boolean;
}

const ProductCard = ({ product, showDiscount = true }: ProductCardProps) => {
  const { addItem } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [isHovered, setIsHovered] = useState(false);
  
  const isWishlisted = isFavorite(product.id);

  // Simulated original price (20% higher for demo)
  const originalPrice = product.price * 1.2;
  const discountPercent = Math.round(((originalPrice - product.price) / originalPrice) * 100);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (product.stock <= 0) {
      toast.error('Produto fora de estoque');
      return;
    }

    addItem({
      id: product.id,
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.image_url || undefined,
      stock: product.stock,
    });

    toast.success('Adicionado ao carrinho!', {
      action: {
        label: 'Ver carrinho',
        onClick: () => window.location.href = '/carrinho',
      },
    });
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(product.id);
    toast.success(isWishlisted ? 'Removido dos favoritos' : 'Adicionado aos favoritos');
  };

  const isOutOfStock = product.stock <= 0;

  return (
    <Link 
      to={`/produto/${product.id}`}
      className="group block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative bg-card rounded-xl border overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-store-primary/30">
        {/* Image Container */}
        <div className="relative aspect-square overflow-hidden bg-store-secondary/30">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className={cn(
                "w-full h-full object-cover transition-transform duration-500",
                isHovered && "scale-110"
              )}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-store-secondary to-store-secondary/50">
              <Package className="h-16 w-16 text-muted-foreground/30" />
            </div>
          )}
          
          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {showDiscount && discountPercent > 0 && (
              <Badge className="bg-store-deal hover:bg-store-deal text-white font-bold px-2 py-1">
                -{discountPercent}%
              </Badge>
            )}
            {product.stock > 0 && product.stock <= 5 && (
              <Badge variant="secondary" className="bg-warning text-warning-foreground text-xs">
                Últimas unidades!
              </Badge>
            )}
          </div>

          {/* Quick Actions */}
          <div className={cn(
            "absolute top-2 right-2 flex flex-col gap-2 transition-all duration-300",
            isHovered ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
          )}>
            <Button
              size="icon"
              variant="secondary"
              className={cn(
                "h-9 w-9 rounded-full shadow-lg",
                isWishlisted && "bg-store-primary text-store-accent hover:bg-store-primary/90"
              )}
              onClick={handleWishlist}
            >
              <Heart className={cn("h-4 w-4", isWishlisted && "fill-current")} />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="h-9 w-9 rounded-full shadow-lg"
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Out of stock overlay */}
          {isOutOfStock && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
              <Badge variant="secondary" className="text-sm font-semibold">
                Esgotado
              </Badge>
            </div>
          )}

          {/* Add to Cart Button */}
          <div className={cn(
            "absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-store-accent/80 to-transparent transition-all duration-300",
            isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}>
            <Button
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              className="w-full gap-2 bg-store-primary hover:bg-store-primary/90 text-store-accent font-semibold"
            >
              <ShoppingCart className="h-4 w-4" />
              Adicionar
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Rating */}
          <div className="flex items-center gap-1 mb-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={cn(
                  "h-3 w-3",
                  star <= 4 ? "fill-warning text-warning" : "text-muted-foreground/30"
                )}
              />
            ))}
            <span className="text-xs text-muted-foreground ml-1">(128)</span>
          </div>

          {/* Title */}
          <h3 className="font-medium text-sm line-clamp-2 min-h-[2.5rem] group-hover:text-store-primary transition-colors">
            {product.name}
          </h3>
          
          {/* Pricing */}
          <div className="mt-3 space-y-1">
            {showDiscount && (
              <p className="text-xs text-muted-foreground line-through">
                {formatPrice(originalPrice)}
              </p>
            )}
            <p className="text-xl font-bold text-store-accent">
              {formatPrice(product.price)}
            </p>
            <p className="text-xs text-muted-foreground">
              em até <span className="font-semibold text-foreground">12x de {formatPrice(product.price / 12)}</span>
            </p>
          </div>

          {/* Free shipping badge */}
          {product.price >= 199 && (
            <Badge variant="outline" className="mt-2 text-store-primary border-store-primary text-xs">
              Frete Grátis
            </Badge>
          )}
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
