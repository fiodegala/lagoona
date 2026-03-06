import { useState, useEffect, useMemo, useCallback } from 'react';
import StoreLayout from '@/components/store/StoreLayout';
import { productsService, Product } from '@/services/products';
import { categoriesService, Category } from '@/services/categories';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Share2, MessageCircle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

const WHATSAPP_NUMBER = '556299416578';

const formatPrice = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface VariationInfo {
  id: string;
  image_url: string | null;
  label: string;
}

type ProductVariationsMap = Record<string, VariationInfo[]>;

const CatalogPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [variationsMap, setVariationsMap] = useState<ProductVariationsMap>({});
  

  useEffect(() => {
    const load = async () => {
      try {
        const [prods, cats] = await Promise.all([
          productsService.getAll(),
          categoriesService.getAll(),
        ]);
        const activeProducts = prods.filter((p) => p.is_active);
        setProducts(activeProducts);
        setCategories(cats);

        // Fetch variations with images for all active products
        const productIds = activeProducts.map((p) => p.id);
        if (productIds.length > 0) {
          const { data: variations } = await supabase
            .from('product_variations')
            .select('id, product_id, image_url, is_active')
            .in('product_id', productIds)
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

          if (variations && variations.length > 0) {
            // Fetch variation attribute values for labels
            const varIds = variations.map((v) => v.id);
            const { data: varValues } = await supabase
              .from('product_variation_values')
              .select('variation_id, attribute_value_id')
              .in('variation_id', varIds);

            const attrValueIds = [...new Set((varValues || []).map((vv) => vv.attribute_value_id))];
            let attrValuesMap: Record<string, string> = {};
            if (attrValueIds.length > 0) {
              const { data: attrValues } = await supabase
                .from('product_attribute_values')
                .select('id, value')
                .in('id', attrValueIds);
              if (attrValues) {
                attrValuesMap = Object.fromEntries(attrValues.map((av) => [av.id, av.value]));
              }
            }

            // Build variation labels per variation_id
            const varLabelsMap: Record<string, string[]> = {};
            (varValues || []).forEach((vv) => {
              if (!varLabelsMap[vv.variation_id]) varLabelsMap[vv.variation_id] = [];
              const val = attrValuesMap[vv.attribute_value_id];
              if (val) varLabelsMap[vv.variation_id].push(val);
            });

            // Group by product
            const map: ProductVariationsMap = {};
            variations.forEach((v) => {
              if (!map[v.product_id]) map[v.product_id] = [];
              map[v.product_id].push({
                id: v.id,
                image_url: v.image_url,
                label: (varLabelsMap[v.id] || []).join(' / ') || 'Variação',
              });
            });
            setVariationsMap(map);
          }
        }
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

  // Build all images list per product (original + variation images)
  const productImagesMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    products.forEach((product) => {
      const images: string[] = [];
      if (product.image_url) images.push(product.image_url);
      const variations = variationsMap[product.id] || [];
      variations.forEach((v) => {
        if (v.image_url && !images.includes(v.image_url)) {
          images.push(v.image_url);
        }
      });
      if (images.length === 0) images.push('/placeholder.svg');
      map[product.id] = images;
    });
    return map;
  }, [products, variationsMap]);

  const [imageIndex, setImageIndex] = useState<Record<string, number>>({});

  const getDisplayImage = (product: Product) => {
    const images = productImagesMap[product.id] || ['/placeholder.svg'];
    const idx = imageIndex[product.id] || 0;
    return images[idx] || images[0];
  };

  const navigateImage = useCallback((productId: string, direction: 'prev' | 'next') => {
    const images = productImagesMap[productId] || [];
    if (images.length <= 1) return;
    setImageIndex((prev) => {
      const current = prev[productId] || 0;
      const next = direction === 'next'
        ? (current + 1) % images.length
        : (current - 1 + images.length) % images.length;
      return { ...prev, [productId]: next };
    });
  }, [productImagesMap]);

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((product) => {
                const variations = variationsMap[product.id] || [];
                const variationsWithImages = variations.filter((v) => v.image_url);

                return (
                  <div
                    key={product.id}
                    className="group rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden flex flex-col"
                  >
                    {/* Image 4:7 ratio with arrows */}
                    {(() => {
                      const images = productImagesMap[product.id] || ['/placeholder.svg'];
                      const hasMultiple = images.length > 1;
                      const currentIdx = imageIndex[product.id] || 0;
                      return (
                        <div
                          className="relative bg-muted overflow-hidden group/img"
                          style={{ aspectRatio: '4/7' }}
                          onTouchStart={(e) => {
                            (e.currentTarget as any)._touchStartX = e.touches[0].clientX;
                            (e.currentTarget as any)._touchStartY = e.touches[0].clientY;
                          }}
                          onTouchEnd={(e) => {
                            const startX = (e.currentTarget as any)._touchStartX || 0;
                            const startY = (e.currentTarget as any)._touchStartY || 0;
                            const dx = e.changedTouches[0].clientX - startX;
                            const dy = e.changedTouches[0].clientY - startY;
                            if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
                              navigateImage(product.id, dx < 0 ? 'next' : 'prev');
                            }
                          }}
                        >
                          <img
                            src={getDisplayImage(product)}
                            alt={product.name}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-300"
                          />
                          {hasMultiple && (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); navigateImage(product.id, 'prev'); }}
                                className="absolute left-1 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm rounded-full p-1 shadow opacity-0 group-hover/img:opacity-100 transition-opacity"
                                aria-label="Foto anterior"
                              >
                                <ChevronLeft className="h-4 w-4 text-foreground" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); navigateImage(product.id, 'next'); }}
                                className="absolute right-1 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm rounded-full p-1 shadow opacity-0 group-hover/img:opacity-100 transition-opacity"
                                aria-label="Próxima foto"
                              >
                                <ChevronRight className="h-4 w-4 text-foreground" />
                              </button>
                              {/* Dots */}
                              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
                                {images.map((_, i) => (
                                  <span
                                    key={i}
                                    className={`block w-1.5 h-1.5 rounded-full transition-colors ${
                                      i === currentIdx ? 'bg-primary' : 'bg-background/60'
                                    }`}
                                  />
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}

                    {/* Clickable variation labels */}
                    {variations.length > 0 && (
                      <div className="px-3 pt-2 flex flex-wrap gap-1.5">
                        {variations.map((v) => {
                          const images = productImagesMap[product.id] || [];
                          const imgIdx = v.image_url ? images.indexOf(v.image_url) : -1;
                          const isSelected = imgIdx >= 0 && (imageIndex[product.id] || 0) === imgIdx;
                          return (
                            <button
                              key={v.id}
                              onClick={() => {
                                if (imgIdx >= 0) {
                                  setImageIndex((prev) => ({ ...prev, [product.id]: imgIdx }));
                                }
                              }}
                              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium border transition-all ${
                                isSelected
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                              }`}
                            >
                              {v.label}
                            </button>
                          );
                        })}
                      </div>
                    )}

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
                );
              })}
            </div>
          )}
        </div>
      </div>
    </StoreLayout>
  );
};

export default CatalogPage;
