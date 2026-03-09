import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import StoreLayout from '@/components/store/StoreLayout';
import { productsService, Product } from '@/services/products';
import { categoriesService, Category } from '@/services/categories';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Share2, MessageCircle, Loader2, ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getOptimizedImageUrl } from '@/lib/imageUtils';

const WHATSAPP_NUMBER = '556299416578';
const PAGE_SIZE = 16;

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
  const [variationsLoading, setVariationsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [variationsMap, setVariationsMap] = useState<ProductVariationsMap>({});
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loaderRef = useRef<HTMLDivElement>(null);

  // Load products and categories first (fast), then variations in background
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const [prods, cats] = await Promise.all([
          productsService.getAll(),
          categoriesService.getAll(),
        ]);
        const activeProducts = prods.filter((p) => (p as any).visible_in_catalog !== false);
        setProducts(activeProducts);
        setCategories(cats);
        setLoading(false);

        // Load variations in background (non-blocking)
        loadVariations(activeProducts);
      } catch (e) {
        console.error('Error loading catalog:', e);
        setLoading(false);
      }
    };
    loadProducts();
  }, []);

  const loadVariations = async (activeProducts: Product[]) => {
    try {
      const productIds = activeProducts.map((p) => p.id);
      if (productIds.length === 0) {
        setVariationsLoading(false);
        return;
      }

      const { data: variations } = await supabase
        .from('product_variations')
        .select('id, product_id, image_url, is_active, sku')
        .in('product_id', productIds)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (!variations || variations.length === 0) {
        setVariationsLoading(false);
        return;
      }

      const varIds = variations.map((v) => v.id);
      const chunkSize = 500;

      // Parallel batch fetch: variation_values and we'll chain attribute lookups
      let allVarValues: { variation_id: string; attribute_value_id: string }[] = [];
      const varChunks = [];
      for (let i = 0; i < varIds.length; i += chunkSize) {
        varChunks.push(varIds.slice(i, i + chunkSize));
      }
      const varValueResults = await Promise.all(
        varChunks.map((chunk) =>
          supabase
            .from('product_variation_values')
            .select('variation_id, attribute_value_id')
            .in('variation_id', chunk)
        )
      );
      varValueResults.forEach((r) => {
        if (r.data) allVarValues = allVarValues.concat(r.data);
      });

      const allAttrValueIds = [...new Set(allVarValues.map((vv) => vv.attribute_value_id))];

      // Parallel batch: attribute values
      const attrChunks = [];
      for (let i = 0; i < allAttrValueIds.length; i += chunkSize) {
        attrChunks.push(allAttrValueIds.slice(i, i + chunkSize));
      }
      let allAttrValues: { id: string; value: string; attribute_id: string }[] = [];
      const attrValueResults = await Promise.all(
        attrChunks.map((chunk) =>
          supabase
            .from('product_attribute_values')
            .select('id, value, attribute_id')
            .in('id', chunk)
        )
      );
      attrValueResults.forEach((r) => {
        if (r.data) allAttrValues = allAttrValues.concat(r.data);
      });

      // Parallel batch: attribute definitions (color filter)
      const allAttrIds = [...new Set(allAttrValues.map((av) => av.attribute_id))];
      const attrDefChunks = [];
      for (let i = 0; i < allAttrIds.length; i += chunkSize) {
        attrDefChunks.push(allAttrIds.slice(i, i + chunkSize));
      }
      let colorAttrIdSet = new Set<string>();
      const attrDefResults = await Promise.all(
        attrDefChunks.map((chunk) =>
          supabase
            .from('product_attributes')
            .select('id, name')
            .in('id', chunk)
            .ilike('name', '%cor%')
        )
      );
      attrDefResults.forEach((r) => {
        if (r.data) r.data.forEach((a) => colorAttrIdSet.add(a.id));
      });

      // Build color map
      const colorAttrValuesMap: Record<string, string> = {};
      allAttrValues.forEach((av) => {
        if (colorAttrIdSet.has(av.attribute_id)) {
          colorAttrValuesMap[av.id] = av.value;
        }
      });

      const varLabelsMap: Record<string, string[]> = {};
      allVarValues.forEach((vv) => {
        const colorName = colorAttrValuesMap[vv.attribute_value_id];
        if (colorName) {
          if (!varLabelsMap[vv.variation_id]) varLabelsMap[vv.variation_id] = [];
          varLabelsMap[vv.variation_id].push(colorName);
        }
      });

      const map: ProductVariationsMap = {};
      variations.forEach((v) => {
        if (!map[v.product_id]) map[v.product_id] = [];
        const colorLabel = (varLabelsMap[v.id] || []).join(' / ');
        if (colorLabel && map[v.product_id].some((existing) => existing.label === colorLabel)) {
          const existingIdx = map[v.product_id].findIndex((existing) => existing.label === colorLabel);
          if (!map[v.product_id][existingIdx].image_url && v.image_url) {
            map[v.product_id][existingIdx].image_url = v.image_url;
          }
          return;
        }
        const label = colorLabel || v.sku || `Var. ${(map[v.product_id]?.length || 0) + 1}`;
        if (!colorLabel && map[v.product_id].some((existing) => existing.label === label)) return;
        map[v.product_id].push({
          id: v.id,
          image_url: v.image_url,
          label,
        });
      });
      setVariationsMap(map);
    } catch (e) {
      console.error('Error loading variations:', e);
    } finally {
      setVariationsLoading(false);
    }
  };

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

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedCategory, search]);

  const visibleProducts = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = visibleCount < filtered.length;

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (!loaderRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filtered.length));
        }
      },
      { rootMargin: '400px' }
    );
    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, filtered.length]);

  const catalogUrl = typeof window !== 'undefined' ? window.location.origin + '/catalogo' : '';

  const shareCatalog = () => {
    const text = encodeURIComponent(`Confira nosso catálogo de produtos:\n${catalogUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const [generatingPdf, setGeneratingPdf] = useState(false);

  const generatePDF = useCallback(async () => {
    setGeneratingPdf(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Catálogo de Produtos', 105, 20, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text('Varejo e Atacado', 105, 27, { align: 'center' });
      doc.setTextColor(0, 0, 0);

      const categoryMap = new Map<string, Product[]>();
      const uncategorized: Product[] = [];
      filtered.forEach((p) => {
        if (p.category_id) {
          const cat = categories.find((c) => c.id === p.category_id);
          const catName = cat?.name || 'Outros';
          if (!categoryMap.has(catName)) categoryMap.set(catName, []);
          categoryMap.get(catName)!.push(p);
        } else {
          uncategorized.push(p);
        }
      });
      if (uncategorized.length > 0) categoryMap.set('Outros', uncategorized);

      let startY = 35;

      categoryMap.forEach((prods, catName) => {
        if (startY > 260) {
          doc.addPage();
          startY = 20;
        }

        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text(catName, 14, startY);
        doc.setTextColor(0, 0, 0);
        startY += 2;

        const tableData = prods.map((p) => {
          const colors = (variationsMap[p.id] || []).map((v) => v.label).join(', ');
          return [
            p.name,
            colors || '—',
            formatPrice(p.price),
            p.wholesale_price && p.wholesale_price > 0 ? formatPrice(p.wholesale_price) : '—',
          ];
        });

        autoTable(doc, {
          startY,
          head: [['Produto', 'Cores', 'Varejo', 'Atacado']],
          body: tableData,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold', fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 65 },
            1: { cellWidth: 65 },
            2: { cellWidth: 25, halign: 'right' },
            3: { cellWidth: 25, halign: 'right', textColor: [22, 163, 74] },
          },
          margin: { left: 14, right: 14 },
          didDrawPage: () => {
            doc.setFontSize(7);
            doc.setTextColor(150);
            doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 14, 290);
            doc.text('Fio de Gala', 196, 290, { align: 'right' });
          },
        });

        startY = (doc as any).lastAutoTable?.finalY + 8 || startY + 20;
      });

      doc.save('catalogo-fio-de-gala.pdf');
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
    } finally {
      setGeneratingPdf(false);
    }
  }, [filtered, categories, variationsMap]);

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
  const [lightbox, setLightbox] = useState<{ productId: string; index: number } | null>(null);

  const openLightbox = useCallback((productId: string, index: number) => {
    setLightbox({ productId, index });
  }, []);

  const closeLightbox = useCallback(() => setLightbox(null), []);

  const lightboxNavigate = useCallback((direction: 'prev' | 'next') => {
    if (!lightbox) return;
    const images = productImagesMap[lightbox.productId] || [];
    if (images.length <= 1) return;
    const next = direction === 'next'
      ? (lightbox.index + 1) % images.length
      : (lightbox.index - 1 + images.length) % images.length;
    setLightbox({ ...lightbox, index: next });
  }, [lightbox, productImagesMap]);

  const getDisplayImage = useCallback((product: Product, size: 'thumb' | 'full' = 'thumb') => {
    const images = productImagesMap[product.id] || ['/placeholder.svg'];
    const idx = imageIndex[product.id] || 0;
    const url = images[idx] || images[0];
    // Use 480px for thumbnails - good quality without excess bandwidth
    return size === 'thumb' ? getOptimizedImageUrl(url, { width: 480, quality: 80 }) : url;
  }, [productImagesMap, imageIndex]);

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
            <div className="flex gap-2 justify-center flex-wrap">
              <Button onClick={shareCatalog} variant="outline" size="sm" className="gap-2">
                <Share2 className="h-4 w-4" />
                Compartilhar via WhatsApp
              </Button>
              <Button onClick={generatePDF} variant="outline" size="sm" className="gap-2" disabled={generatingPdf || loading}>
                {generatingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Baixar PDF
              </Button>
            </div>
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

          {/* Category filter - horizontal scroll */}
          {visibleCategories.length > 0 && (
            <div className="relative -mx-4 px-4">
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar snap-x">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`shrink-0 snap-start rounded-full px-4 py-1.5 text-xs font-medium border transition-all whitespace-nowrap ${
                    selectedCategory === null
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-border bg-card text-muted-foreground hover:border-foreground hover:text-foreground'
                  }`}
                >
                  Todos
                </button>
                {visibleCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`shrink-0 snap-start rounded-full px-4 py-1.5 text-xs font-medium border transition-all whitespace-nowrap ${
                      selectedCategory === cat.id
                        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                        : 'border-border bg-card text-muted-foreground hover:border-foreground hover:text-foreground'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
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
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {visibleProducts.map((product, productIndex) => {
                  const variations = variationsMap[product.id] || [];

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
                              src={getDisplayImage(product, 'thumb')}
                              alt={product.name}
                              loading={productIndex < 4 ? 'eager' : 'lazy'}
                              decoding="async"
                              fetchPriority={productIndex < 4 ? 'high' : undefined}
                              className="w-full h-full object-cover transition-transform duration-300 cursor-pointer"
                              onClick={() => openLightbox(product.id, imageIndex[product.id] || 0)}
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
                            <p className="text-base font-bold text-emerald-600">
                              Atacado: {formatPrice(product.wholesale_price)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Infinite scroll trigger / Load more */}
              {hasMore && (
                <div ref={loaderRef} className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}

              {!hasMore && filtered.length > PAGE_SIZE && (
                <p className="text-center text-muted-foreground text-sm py-4">
                  Todos os {filtered.length} produtos exibidos
                </p>
              )}
            </>
          )}
        </div>

        {/* Lightbox Modal */}
        {lightbox && (() => {
          const images = productImagesMap[lightbox.productId] || [];
          const currentImage = images[lightbox.index] || images[0];
          const product = products.find(p => p.id === lightbox.productId);
          return (
            <div
              className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center"
              onClick={closeLightbox}
              onTouchStart={(e) => {
                (e.currentTarget as any)._touchX = e.touches[0].clientX;
              }}
              onTouchEnd={(e) => {
                const startX = (e.currentTarget as any)._touchX || 0;
                const dx = e.changedTouches[0].clientX - startX;
                if (Math.abs(dx) > 50) {
                  e.stopPropagation();
                  lightboxNavigate(dx < 0 ? 'next' : 'prev');
                }
              }}
            >
              <button
                onClick={closeLightbox}
                className="absolute top-4 right-4 z-10 bg-background/20 backdrop-blur-sm rounded-full p-2 text-white hover:bg-background/40 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>

              {images.length > 1 && (
                <div className="absolute top-4 left-4 z-10 bg-background/20 backdrop-blur-sm rounded-full px-3 py-1 text-white text-sm font-medium">
                  {lightbox.index + 1} / {images.length}
                </div>
              )}

              {product && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-background/20 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-sm font-medium max-w-[80%] text-center truncate">
                  {product.name}
                </div>
              )}

              {images.length > 1 && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); lightboxNavigate('prev'); }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-10 bg-background/20 backdrop-blur-sm rounded-full p-2 text-white hover:bg-background/40 transition-colors"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); lightboxNavigate('next'); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-10 bg-background/20 backdrop-blur-sm rounded-full p-2 text-white hover:bg-background/40 transition-colors"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                </>
              )}

              <img
                src={getOptimizedImageUrl(currentImage, { width: 1200, quality: 85 })}
                alt={product?.name || ''}
                className="max-w-[90vw] max-h-[85vh] object-contain select-none"
                decoding="async"
                onClick={(e) => e.stopPropagation()}
              />

              {images.length > 1 && (
                <div className="absolute bottom-14 left-1/2 -translate-x-1/2 flex gap-2 max-w-[90vw] overflow-x-auto no-scrollbar px-2">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); setLightbox({ ...lightbox, index: i }); }}
                      className={`flex-shrink-0 w-12 h-12 rounded-md overflow-hidden border-2 transition-all ${
                        i === lightbox.index ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={getOptimizedImageUrl(img, { width: 96, quality: 70 })} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </StoreLayout>
  );
};

export default CatalogPage;
