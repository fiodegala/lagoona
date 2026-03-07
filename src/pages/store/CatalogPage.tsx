import { useState, useEffect, useMemo, useCallback } from 'react';
import StoreLayout from '@/components/store/StoreLayout';
import { productsService, Product } from '@/services/products';
import { categoriesService, Category } from '@/services/categories';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Share2, MessageCircle, Loader2, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
        const activeProducts = prods.filter((p) => (p as any).visible_in_catalog !== false);
        setProducts(activeProducts);
        setCategories(cats);

        // Fetch variations with images for all active products
        const productIds = activeProducts.map((p) => p.id);
        if (productIds.length > 0) {
          const { data: variations } = await supabase
            .from('product_variations')
            .select('id, product_id, image_url, is_active, sku')
            .in('product_id', productIds)
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

          if (variations && variations.length > 0) {
            const varIds = variations.map((v) => v.id);

            // Fetch variation values (links variation -> attribute_value)
            // Batch varIds in chunks of 500 to avoid URL length limits
            const chunkSize = 500;
            let allVarValues: { variation_id: string; attribute_value_id: string }[] = [];
            for (let i = 0; i < varIds.length; i += chunkSize) {
              const chunk = varIds.slice(i, i + chunkSize);
              const { data: vv } = await supabase
                .from('product_variation_values')
                .select('variation_id, attribute_value_id')
                .in('variation_id', chunk);
              if (vv) allVarValues = allVarValues.concat(vv);
            }

            // Get all unique attribute_value_ids
            const allAttrValueIds = [...new Set(allVarValues.map((vv) => vv.attribute_value_id))];

            // Fetch attribute values with their attribute info (batched)
            let allAttrValues: { id: string; value: string; attribute_id: string }[] = [];
            for (let i = 0; i < allAttrValueIds.length; i += chunkSize) {
              const chunk = allAttrValueIds.slice(i, i + chunkSize);
              const { data: av } = await supabase
                .from('product_attribute_values')
                .select('id, value, attribute_id')
                .in('id', chunk);
              if (av) allAttrValues = allAttrValues.concat(av);
            }

            // Fetch the attribute definitions to identify color attributes
            const allAttrIds = [...new Set(allAttrValues.map((av) => av.attribute_id))];
            let colorAttrIdSet = new Set<string>();
            for (let i = 0; i < allAttrIds.length; i += chunkSize) {
              const chunk = allAttrIds.slice(i, i + chunkSize);
              const { data: attrs } = await supabase
                .from('product_attributes')
                .select('id, name')
                .in('id', chunk)
                .ilike('name', '%cor%');
              if (attrs) attrs.forEach((a) => colorAttrIdSet.add(a.id));
            }

            // Build map: attribute_value_id -> color name (only for color attributes)
            const colorAttrValuesMap: Record<string, string> = {};
            allAttrValues.forEach((av) => {
              if (colorAttrIdSet.has(av.attribute_id)) {
                colorAttrValuesMap[av.id] = av.value;
              }
            });

            // Build color labels per variation_id
            const varLabelsMap: Record<string, string[]> = {};
            allVarValues.forEach((vv) => {
              const colorName = colorAttrValuesMap[vv.attribute_value_id];
              if (colorName) {
                if (!varLabelsMap[vv.variation_id]) varLabelsMap[vv.variation_id] = [];
                varLabelsMap[vv.variation_id].push(colorName);
              }
            });

            // Group by product, deduplicating by color label
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

  const [generatingPdf, setGeneratingPdf] = useState(false);

  const generatePDF = useCallback(async () => {
    setGeneratingPdf(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      // Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Catálogo de Produtos', 105, 20, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text('Varejo e Atacado', 105, 27, { align: 'center' });
      doc.setTextColor(0, 0, 0);

      // Group products by category
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
        // Category header
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
            // Footer
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
          )}
        </div>
      </div>
    </StoreLayout>
  );
};

export default CatalogPage;
