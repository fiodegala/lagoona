import { Link } from 'react-router-dom';
import { Package, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';
import { Product } from '@/services/products';

interface ProductCardProps {
  product: Product;
}

const ProductCard = ({ product }: ProductCardProps) => {
  const { addItem } = useCart();

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

    toast.success('Produto adicionado ao carrinho');
  };

  const isOutOfStock = product.stock <= 0;

  return (
    <Link to={`/produto/${product.id}`}>
      <Card className="group overflow-hidden h-full hover:shadow-lg transition-all duration-300 border-border/50">
        {/* Image */}
        <div className="aspect-square relative overflow-hidden bg-muted">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-16 w-16 text-muted-foreground/30" />
            </div>
          )}
          
          {/* Out of stock overlay */}
          {isOutOfStock && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
              <Badge variant="secondary" className="text-sm">
                Fora de estoque
              </Badge>
            </div>
          )}
        </div>

        <CardContent className="p-4">
          <h3 className="font-medium line-clamp-2 min-h-[2.5rem] group-hover:text-primary transition-colors">
            {product.name}
          </h3>
          
          <p className="text-xl font-bold text-primary mt-2">
            {formatPrice(product.price)}
          </p>
          
          {product.stock > 0 && product.stock <= 5 && (
            <p className="text-xs text-warning mt-1">
              Apenas {product.stock} em estoque
            </p>
          )}
        </CardContent>

        <CardFooter className="p-4 pt-0">
          <Button
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            className="w-full gap-2"
            variant={isOutOfStock ? "secondary" : "default"}
          >
            <ShoppingCart className="h-4 w-4" />
            {isOutOfStock ? 'Indisponível' : 'Adicionar'}
          </Button>
        </CardFooter>
      </Card>
    </Link>
  );
};

export default ProductCard;
