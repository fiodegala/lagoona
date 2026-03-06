import { useState, useEffect, useMemo } from 'react';
import StoreLayout from '@/components/store/StoreLayout';
import { productsService, Product } from '@/services/products';
import { categoriesService, Category } from '@/services/categories';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Share2, MessageCircle, Loader2 } from 'lucide-react';

const WHATSAPP_NUMBER = '556299416578';

const formatPrice = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const CatalogPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [prods, cats] = await Promise.all([
          productsService.getAll(),
          categoriesService.getAll(),
        ]);
        setProducts(prods.filter((p) => p.is_active));
        setCategories(cats);
      } catch (e) {
        console.error('Error loading catalog:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = products;
    if (selectedCategory) {
      list = list.filter((p) => p.category_id === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [products, selectedCategory, search]);

  const catalogUrl = typeof window !== 'undefined' ? window.location.origin + '/catalogo' : '';

  const shareCatalog = () => {
    const text = encodeURIComponent(`Confira nosso catálogo de produtos:\n${catalogUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const askAboutProduct = (product: Product) => {
    const productUrl = `${window.location.origin}/produto/${product.id}`;
    const text = encodeURIComponent(
      `Olá! Tenho interesse no produto: *${product.name}*\n${productUrl}`
    );
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, '_blank');
  };

  const usedCategoryIds = useMemo(
    () => new Set(products.map((p) => p.category_id).filter(Boolean)),
    [products]
  );
  const visibleCategories = categories.filter((c) => usedCategoryIds.has(c.id));

  return (
    <StoreLayout>
      <div className="min-h-screen bg-background">
        {/* Hero */}
        <div className="bg-primary/5 py-8 md:py-12">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-2xl md:text-4xl font-bold text-foreground mb-2">
              Catálogo de Produtos
            </h1>
            <p className="text-muted-foreground text-sm md:text-base mb-4">
              Confira todos os nossos produtos — varejo e atacado
            </p>
            <Button onClick={shareCatalog} variant="outline" size="sm" className="gap-2">
              <Share2 className="h-4 w-4" />
              Compartilhar via WhatsApp
            </Button>
          </div>
        </div>

        <div className="container mx-auto px-4 py-6 space-y-5">
          {/* Search */}
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Category chips */}
          {visibleCategories.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center">
              <Badge
                variant={selectedCategory === null ? 'default' : 'outline'}
                className="cursor-pointer select-none"
                onClick={() => setSelectedCategory(null)}
              >
                Todos
              </Badge>
              {visibleCategories.map((cat) => (
                <Badge
                  key={cat.id}
                  variant={selectedCategory === cat.id ? 'default' : 'outline'}
                  className="cursor-pointer select-none"
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.name}
                </Badge>
              ))}
            </div>
          )}

          {/* Grid */}
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-20">
              Nenhum produto encontrado.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map((product) => (
                <div
                  key={product.id}
                  className="group rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden flex flex-col"
                >
                  {/* Image */}
                  <div className="aspect-square bg-muted overflow-hidden">
                    <img
                      src={product.image_url || '/placeholder.svg'}
                      alt={product.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>

                  {/* Info */}
                  <div className="p-3 flex flex-col flex-1 gap-2">
                    <h3 className="text-sm font-medium text-foreground line-clamp-2 leading-tight">
                      {product.name}
                    </h3>

                    <div className="mt-auto space-y-0.5">
                      <p className="text-base font-bold text-primary">
                        {formatPrice(product.price)}
                      </p>
                      {product.wholesale_price != null && product.wholesale_price > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Atacado: {formatPrice(product.wholesale_price)}
                        </p>
                      )}
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full gap-1.5 mt-1 text-xs"
                      onClick={() => askAboutProduct(product)}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      Pedir pelo WhatsApp
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </StoreLayout>
  );
};

export default CatalogPage;
