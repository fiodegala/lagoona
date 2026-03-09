import { useEffect, useState, lazy, Suspense, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2, ShoppingBag, Truck, RefreshCw, Shield, MessageCircle, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StoreLayout from '@/components/store/StoreLayout';
import { useSwipe } from '@/hooks/useSwipe';
import ProductCard from '@/components/store/ProductCard';
import { getOptimizedImageUrl } from '@/lib/imageUtils';
import { productsService, Product } from '@/services/products';
import { categoriesService, Category } from '@/services/categories';
import { bannersService, Banner } from '@/services/banners';
import { enrichProductsWithStock } from '@/services/stockService';
import { supabase } from '@/integrations/supabase/client';
import { useProductCardsMeta } from '@/hooks/useProductCardsMeta';

// Lazy load below-fold sections
const DealsCountdownSection = lazy(() => import('@/components/store/DealsCountdownSection'));
const VideoTestimonialsSection = lazy(() => import('@/components/store/VideoTestimonialsSection'));
const FeaturedProductSection = lazy(() => import('@/components/store/FeaturedProductSection'));

// Normalize banner link_url: strip origin for internal links so React Router works
const normalizeBannerUrl = (url: string | null): string | null => {
  if (!url) return null;
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin === window.location.origin) {
      return parsed.pathname + parsed.search + parsed.hash;
    }
  } catch {
    // already a relative path
  }
  return url;
};

const HomePage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [heroBanners, setHeroBanners] = useState<Banner[]>([]);
  const [promoBanners, setPromoBanners] = useState<Banner[]>([]);
  const [midBanners, setMidBanners] = useState<Banner[]>([]);
  const [currentHeroBanner, setCurrentHeroBanner] = useState(0);
  const [currentMidBanner, setCurrentMidBanner] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [featuredProduct, setFeaturedProduct] = useState<Product | null>(null);
  const [wholesaleVideoUrl, setWholesaleVideoUrl] = useState('/assets/atacado-fdg.mp4');
  const [wholesaleAutoplay, setWholesaleAutoplay] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [productsData, categoriesData, bannersData, promoData, midData, featuredConfig, wholesaleConfig] = await Promise.all([
          productsService.getAll(),
          categoriesService.getAll(),
          bannersService.getByType('hero').catch(() => []),
          bannersService.getByType('promo').catch(() => []),
          bannersService.getByType('mid').catch(() => []),
          supabase.from('store_config').select('value').eq('key', 'featured_product').maybeSingle(),
          supabase.from('store_config').select('value').eq('key', 'wholesale_video').maybeSingle(),
        ]);
        const activeProducts = productsData.filter(p => p.is_active);
        const enrichedProducts = await enrichProductsWithStock(activeProducts);
        setProducts(enrichedProducts);
        setCategories(categoriesData.filter(c => c.is_active));
        setHeroBanners(bannersData);
        setPromoBanners(promoData);
        setMidBanners(midData);

        // Set featured product from config
        const featuredId = (featuredConfig.data?.value as { product_id?: string })?.product_id;
        if (featuredId && featuredId !== 'none') {
          const fp = enrichedProducts.find(p => p.id === featuredId);
          setFeaturedProduct(fp || null);
        }

        // Set wholesale video from config
        const wvConfig = wholesaleConfig.data?.value as { url?: string; autoplay?: boolean } | undefined;
        if (wvConfig?.url) setWholesaleVideoUrl(wvConfig.url);
        if (typeof wvConfig?.autoplay === 'boolean') setWholesaleAutoplay(wvConfig.autoplay);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Auto-rotate hero banners
  useEffect(() => {
    if (heroBanners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentHeroBanner(prev => (prev + 1) % heroBanners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [heroBanners.length]);

  // Auto-rotate mid banners
  useEffect(() => {
    if (midBanners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentMidBanner(prev => (prev + 1) % midBanners.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [midBanners.length]);

  const newProducts = useMemo(() => 
    [...products].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [products]
  );

  // Produtos com preço promocional (ofertas)
  const dealProducts = useMemo(() => 
    products.filter(p => (p as any).promotional_price && (p as any).promotional_price < p.price),
    [products]
  );

  // Batch-fetch meta for all products shown on the page
  const allDisplayedProductIds = useMemo(() => {
    const ids = new Set<string>();
    newProducts.slice(0, 15).forEach(p => ids.add(p.id));
    products.slice(0, 10).forEach(p => ids.add(p.id));
    dealProducts.forEach(p => ids.add(p.id));
    return Array.from(ids);
  }, [newProducts, products, dealProducts]);

  const { meta: productsMeta } = useProductCardsMeta(allDisplayedProductIds);

  const categoryIcons = ['👕', '👖', '👟', '👜', '💍', '🎮', '📱', '🏠'];

  const lancamentosStartX = useRef(0);

  const heroSwipe = useSwipe({
    onSwipeLeft: useCallback(() => setCurrentHeroBanner(prev => (prev + 1) % heroBanners.length), [heroBanners.length]),
    onSwipeRight: useCallback(() => setCurrentHeroBanner(prev => (prev - 1 + heroBanners.length) % heroBanners.length), [heroBanners.length]),
  });

  const midSwipe = useSwipe({
    onSwipeLeft: useCallback(() => setCurrentMidBanner(prev => (prev + 1) % midBanners.length), [midBanners.length]),
    onSwipeRight: useCallback(() => setCurrentMidBanner(prev => (prev - 1 + midBanners.length) % midBanners.length), [midBanners.length]),
  });

  return (
    <StoreLayout>
      {/* Hero Section */}
      <section className="relative h-[500px] md:h-[600px] lg:h-[700px] overflow-hidden" {...heroSwipe}>
        {isLoading ? (
          <div className="absolute inset-0 bg-store-dark flex items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-store-gold" />
          </div>
        ) : heroBanners.length > 0 ? (
          <>
            {heroBanners.map((banner, index) => {
              const bannerContent = (
                <>
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url('${banner.image_url}')` }}
                  />
                  <div className="absolute inset-0 bg-store-dark/60" />
                  <div className="relative h-full flex items-center">
                    <div className="container mx-auto px-4">
                      <div className="max-w-2xl">
                        {banner.title && (
                          <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white mb-6 leading-tight italic">
                            {banner.title}
                          </h1>
                        )}
                        {banner.subtitle && (
                          <p className="text-lg md:text-xl text-white/70 mb-8 max-w-lg font-light tracking-wide">
                            {banner.subtitle}
                          </p>
                        )}
                        {banner.link_url && (
                          <span className="inline-flex items-center gap-2 bg-store-gold text-store-dark hover:bg-store-gold/90 font-semibold text-base px-8 py-3 rounded-md tracking-wide">
                            Comprar agora
                            <ArrowRight className="h-5 w-5" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              );

              return banner.link_url ? (
                <Link
                  key={banner.id}
                  to={normalizeBannerUrl(banner.link_url) || '/loja'}
                  className="absolute inset-0 transition-opacity duration-700 block cursor-pointer"
                  style={{ opacity: index === currentHeroBanner ? 1 : 0, pointerEvents: index === currentHeroBanner ? 'auto' : 'none', zIndex: index === currentHeroBanner ? 1 : 0 }}
                >
                  {bannerContent}
                </Link>
              ) : (
                <div
                  key={banner.id}
                  className="absolute inset-0 transition-opacity duration-700"
                  style={{ opacity: index === currentHeroBanner ? 1 : 0, zIndex: index === currentHeroBanner ? 1 : 0 }}
                >
                  {bannerContent}
                </div>
              );
            })}
            {heroBanners.length > 1 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 z-10">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
                  onClick={() => setCurrentHeroBanner(prev => (prev - 1 + heroBanners.length) % heroBanners.length)}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                {heroBanners.map((_, idx) => (
                  <button
                    key={idx}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${idx === currentHeroBanner ? 'bg-store-gold scale-125' : 'bg-white/40'}`}
                    onClick={() => setCurrentHeroBanner(idx)}
                  />
                ))}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
                  onClick={() => setCurrentHeroBanner(prev => (prev + 1) % heroBanners.length)}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1920&q=80')` }}
            />
            <div className="absolute inset-0 bg-store-dark/75" />
            <div className="relative h-full flex items-center">
              <div className="container mx-auto px-4">
                <div className="max-w-2xl">
                  <span className="inline-block px-5 py-1.5 text-store-gold text-xs font-semibold tracking-[0.25em] uppercase mb-6 border border-store-gold/40">
                    Nova Coleção 2024
                  </span>
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white mb-6 leading-tight italic">
                    Elegância que define o estilo moderno
                  </h1>
                  <p className="text-lg md:text-xl text-white/70 mb-8 max-w-lg font-light tracking-wide">
                    Descubra peças exclusivas confeccionadas com os melhores materiais.
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <Button asChild size="lg" className="gap-2 bg-store-gold text-store-dark hover:bg-store-gold/90 font-semibold text-base px-8 tracking-wide">
                      <Link to="/loja">
                        Comprar agora
                        <ArrowRight className="h-5 w-5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Benefits Bar */}
      <section className="border-b border-store-gold/10 bg-store-dark">
        <div className="container mx-auto px-4 py-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Truck, title: 'Frete Grátis', desc: 'Acima de R$299,00' },
              { icon: RefreshCw, title: 'Trocas Fáceis', desc: 'Em até 30 dias' },
              { icon: Shield, title: 'Compra Segura', desc: 'Dados protegidos' },
              { icon: MessageCircle, title: 'Atendimento', desc: 'Suporte rápido' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-center gap-3">
                <div className="p-2.5">
                  <Icon className="h-5 w-5 text-store-gold" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-white">{title}</h4>
                  <p className="text-xs text-white/50">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ofertas do Dia com Countdown */}
      {!isLoading && (
        <Suspense fallback={null}>
          <DealsCountdownSection products={dealProducts} />
        </Suspense>
      )}

      {/* Lançamentos - Carrossel */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-2xl md:text-3xl font-display font-bold italic">Lançamentos</h2>
              <div className="w-12 h-0.5 bg-store-gold mt-2" />
            </div>
            <Button variant="outline" asChild className="gap-2 hidden sm:flex">
              <Link to="/loja?ordenar=recentes">
                Ver todos
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : newProducts.length > 0 ? (
            <div className="relative overflow-hidden">
              <div
                id="lancamentos-carousel"
                className="flex gap-4 md:gap-6 overflow-x-auto scrollbar-none -mx-4 px-4 touch-pan-y"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                onTouchStart={(e) => { lancamentosStartX.current = e.touches[0].clientX; }}
                onTouchEnd={(e) => {
                  const delta = e.changedTouches[0].clientX - lancamentosStartX.current;
                  if (Math.abs(delta) > 50) {
                    const el = document.getElementById('lancamentos-carousel');
                    if (el) el.scrollBy({ left: delta < 0 ? 300 : -300, behavior: 'smooth' });
                  }
                }}
              >
                {newProducts.slice(0, 15).map((product) => (
                  <div key={product.id} className="shrink-0 w-[160px] sm:w-[200px] md:w-[220px] lg:w-[240px]">
                    <ProductCard product={product} meta={productsMeta[product.id]} />
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="absolute -left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background shadow-lg border z-10 hidden md:flex"
                onClick={() => {
                  const el = document.getElementById('lancamentos-carousel');
                  if (el) el.scrollBy({ left: -560, behavior: 'smooth' });
                }}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="absolute -right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background shadow-lg border z-10 hidden md:flex"
                onClick={() => {
                  const el = document.getElementById('lancamentos-carousel');
                  if (el) el.scrollBy({ left: 560, behavior: 'smooth' });
                }}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum produto disponível no momento.</p>
            </div>
          )}

          <div className="mt-6 text-center sm:hidden">
            <Button variant="outline" asChild className="gap-2">
              <Link to="/loja?ordenar=recentes">
                Ver todos os lançamentos
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Banner Rotativo Entre Seções */}
      {midBanners.length > 0 && (
        <section className="py-8 md:py-12">
          <div className="container mx-auto px-4">
            <div className="relative overflow-hidden rounded-xl aspect-[21/9] md:aspect-[3/1]" {...midSwipe}>
              {midBanners.map((banner, index) => (
                <Link
                  key={banner.id}
                  to={normalizeBannerUrl(banner.link_url) || '/loja'}
                  className="absolute inset-0 transition-opacity duration-700"
                  style={{ opacity: index === currentMidBanner ? 1 : 0, pointerEvents: index === currentMidBanner ? 'auto' : 'none' }}
                >
                  <img
                    src={banner.image_url}
                    alt={banner.title || 'Banner'}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
                  {(banner.title || banner.subtitle) && (
                    <div className="absolute bottom-0 left-0 right-0 p-5 md:p-8">
                      {banner.title && (
                        <h3 className="text-lg md:text-2xl font-display font-bold text-white mb-1">{banner.title}</h3>
                      )}
                      {banner.subtitle && (
                        <p className="text-sm md:text-base text-white/70 font-light">{banner.subtitle}</p>
                      )}
                    </div>
                  )}
                </Link>
              ))}
              {midBanners.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
                  {midBanners.map((_, idx) => (
                    <button
                      key={idx}
                      className={`w-2 h-2 rounded-full transition-all ${idx === currentMidBanner ? 'bg-store-gold scale-125' : 'bg-white/40'}`}
                      onClick={(e) => { e.preventDefault(); setCurrentMidBanner(idx); }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Categorias em Destaque */}
      {categories.length > 0 && (
        <section className="py-16 md:py-20 bg-store-secondary/50">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-2xl md:text-3xl font-display font-bold italic">Categorias em destaque</h2>
                <div className="w-12 h-0.5 bg-store-gold mt-2" />
              </div>
              <Button variant="outline" asChild className="gap-2 hidden sm:flex">
                <Link to="/categorias">
                  Ver todas
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
              {categories.slice(0, 8).map((category, index) => (
                <Link
                  key={category.id}
                  to={`/loja/categoria/${category.slug}`}
                  className="group relative overflow-hidden rounded-xl bg-background hover:shadow-lg transition-all hover:-translate-y-1 aspect-[4/5]"
                >
                  <div className="absolute inset-0 bg-muted flex items-center justify-center overflow-hidden">
                    {category.image_url ? (
                      <img src={category.image_url} alt={category.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <span className="text-5xl">{categoryIcons[index % categoryIcons.length]}</span>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <span className="text-sm md:text-base font-semibold text-white line-clamp-2">{category.name}</span>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-6 text-center sm:hidden">
              <Button variant="outline" asChild className="gap-2">
                <Link to="/categorias">
                  Ver todas as categorias
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Produto em Destaque - Compra Rápida */}
      {!isLoading && featuredProduct && (
        <Suspense fallback={null}>
          <FeaturedProductSection product={featuredProduct} />
        </Suspense>
      )}

      {/* Banners Promocionais */}
      {promoBanners.length > 0 && (
        <section className="py-10 md:py-14">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {promoBanners.map((banner) => (
                <Link
                  key={banner.id}
                  to={normalizeBannerUrl(banner.link_url) || '/loja'}
                  className="group relative overflow-hidden rounded-xl aspect-[2/1] block"
                >
                  <img
                    src={banner.image_url}
                    alt={banner.title || 'Promoção'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  {(banner.title || banner.subtitle) && (
                    <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6">
                      {banner.title && (
                        <h3 className="text-lg md:text-xl font-display font-bold text-white mb-1">{banner.title}</h3>
                      )}
                      {banner.subtitle && (
                        <p className="text-sm text-white/70 font-light">{banner.subtitle}</p>
                      )}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Mais Vendidos */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg border border-store-gold/20">
                <TrendingUp className="h-5 w-5 text-store-gold" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-display font-bold italic">Mais vendidos</h2>
                <div className="w-12 h-0.5 bg-store-gold mt-2" />
              </div>
            </div>
            <Button variant="outline" asChild className="gap-2 hidden sm:flex">
              <Link to="/loja?sort=bestseller">
                Ver todos
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
              {products.slice(0, 10).map((product) => (
                <ProductCard key={product.id} product={product} meta={productsMeta[product.id]} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum produto disponível no momento.</p>
            </div>
          )}
        </div>
      </section>

      {/* Depoimentos em Vídeo */}
      <Suspense fallback={null}>
        <VideoTestimonialsSection />
      </Suspense>

      {/* Instagram Feed - Elfsight Widget */}
      <section className="py-16 md:py-20 bg-store-secondary/30">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-display font-bold italic">Siga-nos no Instagram</h2>
            <div className="w-12 h-0.5 bg-store-gold mt-2 mx-auto" />
            <p className="text-muted-foreground mt-3 font-light tracking-wide">@fiodegala</p>
            <div className="mt-8">
              <Button asChild variant="outline" className="gap-2 border-store-gold/30 text-store-gold hover:bg-store-gold/10 font-semibold tracking-wide">
                <a href="https://www.instagram.com/fiodegala/" target="_blank" rel="noopener noreferrer">
                  Seguir no Instagram
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Atacado FDG */}
      <section className="bg-store-dark">
        <div className="container mx-auto px-4 py-14 md:py-20">
          <div className="flex flex-col md:flex-row items-center gap-8 md:gap-16">
            <div className="flex-1">
              <span className="inline-block px-5 py-1.5 text-store-gold text-xs font-semibold tracking-[0.25em] uppercase mb-4 border border-store-gold/40">
                Para Lojistas
              </span>
              <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-4 italic">
                Atacado FDG
              </h2>
              <p className="text-white/60 mb-6 max-w-lg font-light tracking-wide">
                Seja um revendedor autorizado e tenha acesso a condições exclusivas, suporte dedicado e produtos de alta qualidade para sua loja.
              </p>
              <Button asChild variant="outline" className="gap-2 border-store-gold/40 text-store-gold hover:bg-store-gold/10 font-semibold tracking-wide">
                <Link to="/atacado">
                  Saiba mais
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="flex-shrink-0">
              <video
                src={wholesaleVideoUrl}
                controls
                loop
                muted
                autoPlay={wholesaleAutoplay}
                playsInline
                preload="none"
                poster="/placeholder.svg"
                className="w-full md:w-[560px] aspect-video object-cover rounded-xl shadow-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="py-14 md:py-20 bg-store-accent">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-display font-bold text-white mb-2 italic">
            Ganhe 10% OFF na primeira compra!
          </h2>
          <p className="text-white/50 mb-8 max-w-xl mx-auto font-light tracking-wide">
            Cadastre seu e-mail e receba ofertas exclusivas, novidades e promoções.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
            <input
              type="email"
              placeholder="Seu melhor e-mail"
              className="flex-1 px-4 py-3 bg-white/5 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:border-store-gold transition-colors"
            />
            <Button size="lg" className="font-semibold bg-store-gold text-store-dark hover:bg-store-gold/90 tracking-wide">
              Quero meu cupom!
            </Button>
          </div>
        </div>
      </section>
    </StoreLayout>
  );
};

export default HomePage;
