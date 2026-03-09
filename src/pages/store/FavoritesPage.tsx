import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingBag, Trash2 } from 'lucide-react';
import StoreLayout from '@/components/store/StoreLayout';
import ProductCard from '@/components/store/ProductCard';
import { Button } from '@/components/ui/button';
import { useFavorites } from '@/contexts/FavoritesContext';
import { productsService, Product } from '@/services/products';
import { enrichProductsWithStock } from '@/services/stockService';
import { useProductCardsMeta } from '@/hooks/useProductCardsMeta';

const FavoritesPage = () => {
  const { favorites, clearFavorites } = useFavorites();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFavoriteProducts = async () => {
      if (favorites.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      try {
        const allProducts = await productsService.getAll();
        const favoriteProducts = allProducts.filter((product) =>
          favorites.includes(product.id)
        );
        const enriched = await enrichProductsWithStock(favoriteProducts);
        setProducts(enriched);
      } catch (error) {
        console.error('Error loading favorite products:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFavoriteProducts();
  }, [favorites]);

  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Heart className="h-8 w-8 text-store-primary fill-store-primary" />
            <div>
              <h1 className="text-2xl font-bold">Meus Favoritos</h1>
              <p className="text-muted-foreground">
                {favorites.length} {favorites.length === 1 ? 'produto' : 'produtos'} salvos
              </p>
            </div>
          </div>

          {favorites.length > 0 && (
            <Button
              variant="outline"
              onClick={clearFavorites}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Limpar favoritos
            </Button>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="aspect-square bg-muted animate-pulse rounded-xl"
              />
            ))}
          </div>
        ) : favorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
              <Heart className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">
              Nenhum favorito ainda
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Explore nossa loja e adicione produtos aos seus favoritos clicando
              no ícone de coração.
            </p>
            <Button asChild className="gap-2">
              <Link to="/loja">
                <ShoppingBag className="h-4 w-4" />
                Explorar produtos
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </StoreLayout>
  );
};

export default FavoritesPage;
