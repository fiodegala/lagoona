import { useState, useEffect, forwardRef, memo } from 'react';
import { Link } from 'react-router-dom';
import { Package, ShoppingCart, Heart, Star, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/contexts/CartContext';
import { useFavorites } from '@/contexts/FavoritesContext';
import { toast } from 'sonner';
import { Product } from '@/services/products';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { thumbnailUrl } from '@/lib/imageUtils';

const COLOR_MAP: Record<string, string> = {
  preto: '#000000', black: '#000000',
  branco: '#FFFFFF', white: '#FFFFFF',
  vermelho: '#EF4444', red: '#EF4444',
  azul: '#3B82F6', blue: '#3B82F6',
  verde: '#22C55E', green: '#22C55E',
  amarelo: '#EAB308', yellow: '#EAB308',
  rosa: '#EC4899', pink: '#EC4899',
  roxo: '#A855F7', purple: '#A855F7',
  laranja: '#F97316', orange: '#F97316',
  marrom: '#92400E', brown: '#92400E',
  cinza: '#6B7280', gray: '#6B7280', grey: '#6B7280',
  bege: '#D2B48C', beige: '#D2B48C',
  nude: '#E8C4A2',
  dourado: '#D4AF37', gold: '#D4AF37',
  prata: '#C0C0C0', silver: '#C0C0C0',
  vinho: '#722F37', burgundy: '#722F37',
  navy: '#1E3A5F', marinho: '#1E3A5F',
  coral: '#FF7F50',
  creme: '#FFFDD0',
  caramelo: '#C68E17',
  terracota: '#E2725B',
  mostarda: '#FFDB58',
  oliva: '#808000', olive: '#808000',
  turquesa: '#40E0D0',
  lavanda: '#E6E6FA',
  lilás: '#C8A2C8',
  salmão: '#FA8072',
  'off white': '#FAF9F6',
};

interface ProductCardProps {
  product: Product;
  showDiscount?: boolean;
}

const ProductCard = memo(forwardRef<HTMLAnchorElement, ProductCardProps>(({ product, showDiscount = true }, ref) => {
  const { addItem } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [isHovered, setIsHovered] = useState(false);
  const [colorValues, setColorValues] = useState<string[]>([]);
  
  const isWishlisted = isFavorite(product.id);

  // Fetch color variations - debounced with IntersectionObserver would be ideal,
  // but at minimum we cache via React state
  useEffect(() => {
    let cancelled = false;
    const fetchColors = async () => {
      const { data: attrs } = await supabase
        .from('product_attributes')
        .select('id, name')
        .eq('product_id', product.id)
        .ilike('name', '%cor%');

      if (cancelled || !attrs || attrs.length === 0) return;

      const attrIds = attrs.map(a => a.id);
      const { data: values } = await supabase
        .from('product_attribute_values')
        .select('value')
        .in('attribute_id', attrIds);

      if (!cancelled && values) {
        setColorValues(values.map(v => v.value));
      }
    };
    fetchColors();
    return () => { cancelled = true; };
  }, [product.id]);

  const hasRealDiscount = (product as any).promotional_price != null && (product as any).promotional_price < product.price;
  const discountPercent = hasRealDiscount
    ? Math.round(((product.price - (product as any).promotional_price) / product.price) * 100)
    : 0;
  const displayPrice = hasRealDiscount ? (product as any).promotional_price : product.price;

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
  const optimizedSrc = thumbnailUrl(product.image_url);

  return (
    <Link 
      to={`/produto/${product.id}`}
      className="group block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative bg-card rounded-none border overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-store-gold/30">
        {/* Image Container */}
        <div className="relative aspect-[4/5] overflow-hidden bg-store-secondary/30">
          {product.image_url ? (
            <img
              src={optimizedSrc}
              alt={product.name}
              loading="lazy"
              decoding="async"
              width={400}
              height={500}
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
            {showDiscount && hasRealDiscount && (
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
                isWishlisted && "bg-store-gold text-store-dark hover:bg-store-gold/90"
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
            "absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-store-dark/80 to-transparent transition-all duration-300",
            isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}>
            <Button
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              className="w-full gap-2 bg-store-gold hover:bg-store-gold/90 text-store-dark font-semibold"
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
          <h3 className="font-medium text-sm line-clamp-2 min-h-[2.5rem] group-hover:text-store-gold transition-colors">
            {product.name}
          </h3>

          {/* Color Swatches */}
          {colorValues.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              {colorValues.slice(0, 5).map((color, idx) => {
                const hex = COLOR_MAP[color.toLowerCase().trim()] || '#CBD5E1';
                const isLight = ['#FFFFFF', '#FAF9F6', '#FFFDD0', '#E6E6FA', '#E8C4A2'].includes(hex);
                return (
                  <span
                    key={idx}
                    title={color}
                    className={cn(
                      "h-4 w-4 rounded-full shrink-0",
                      isLight && "border border-border"
                    )}
                    style={{ backgroundColor: hex }}
                  />
                );
              })}
              {colorValues.length > 5 && (
                <span className="text-xs text-muted-foreground">+{colorValues.length - 5}</span>
              )}
            </div>
          )}
          
          {/* Pricing */}
          <div className="mt-3 space-y-1">
            {showDiscount && hasRealDiscount && (
              <p className="text-xs text-muted-foreground line-through">
                {formatPrice(product.price)}
              </p>
            )}
            <p className="text-xl font-bold text-store-accent">
              {formatPrice(displayPrice)}
            </p>
            <p className="text-xs text-muted-foreground">
              em até <span className="font-semibold text-foreground">6x de {formatPrice(displayPrice / 6)}</span>
            </p>
          </div>

          {/* Free shipping badge */}
          {product.price >= 199 && (
            <Badge variant="outline" className="mt-2 text-store-gold border-store-gold/40 text-xs">
              Frete Grátis
            </Badge>
          )}
        </div>
      </div>
    </Link>
  );
}));

ProductCard.displayName = 'ProductCard';

export default ProductCard;
