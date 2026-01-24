import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2, ShoppingBag, ChevronLeft, ChevronRight, Zap, Clock, Flame, TrendingUp, Sparkles, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StoreLayout from '@/components/store/StoreLayout';
import ProductCard from '@/components/store/ProductCard';
import { productsService, Product } from '@/services/products';
import { categoriesService, Category } from '@/services/categories';

const HomePage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentBanner, setCurrentBanner] = useState(0);

  const banners = [
    {
      title: 'Super Ofertas',
      subtitle: 'Até 70% OFF em produtos selecionados',
      cta: 'Aproveitar',
      bg: 'from-[hsl(var(--store-primary))] to-orange-600',
      link: '/loja',
    },
    {
      title: 'Frete Grátis',
      subtitle: 'Em compras acima de R$199',
      cta: 'Comprar Agora',
      bg: 'from-[hsl(var(--store-secondary))] to-emerald-600',
      link: '/loja',
    },
    {
      title: 'Novidades',
      subtitle: 'Confira os lançamentos da semana',
      cta: 'Ver Novidades',
      bg: 'from-[hsl(var(--store-accent))] to-purple-600',
      link: '/loja?ordenar=recentes',
    },
  ];

  useEffect(() => {
    const loadData = async () => {
      try {
        const [productsData, categoriesData] = await Promise.all([
          productsService.getAll(),
          categoriesService.getAll(),
        ]);
        
        const activeProducts = productsData.filter(p => p.is_active);
        setProducts(activeProducts);
        setCategories(categoriesData.filter(c => c.is_active));
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Auto-rotate banners
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const categoryIcons = ['👕', '👖', '👟', '👜', '💍', '🎮', '📱', '🏠'];

  return (
    <StoreLayout>
      {/* Hero Banner Carousel */}
      <section className="relative overflow-hidden">
        <div className="relative h-[300px] md:h-[400px] lg:h-[500px]">
          {banners.map((banner, index) => (
            <div
              key={index}
              className={`absolute inset-0 transition-all duration-700 ${
                index === currentBanner 
                  ? 'opacity-100 translate-x-0' 
                  : index < currentBanner 
                    ? 'opacity-0 -translate-x-full' 
                    : 'opacity-0 translate-x-full'
              }`}
            >
              <div className={`h-full bg-gradient-to-r ${banner.bg} flex items-center`}>
                <div className="container mx-auto px-4">
                  <div className="max-w-xl text-white">
                    <Badge className="mb-4 bg-white/20 hover:bg-white/30 text-white border-0">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Oferta Especial
                    </Badge>
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 drop-shadow-lg">
                      {banner.title}
                    </h1>
                    <p className="text-lg md:text-xl mb-6 text-white/90">
                      {banner.subtitle}
                    </p>
                    <Button asChild size="lg" variant="secondary" className="gap-2 text-base">
                      <Link to={banner.link}>
                        {banner.cta}
                        <ArrowRight className="h-5 w-5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Banner Navigation */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentBanner(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                index === currentBanner 
                  ? 'bg-white w-8' 
                  : 'bg-white/50 hover:bg-white/70'
              }`}
            />
          ))}
        </div>

        {/* Banner Arrows */}
        <Button
          variant="secondary"
          size="icon"
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full opacity-80 hover:opacity-100"
          onClick={() => setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length)}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full opacity-80 hover:opacity-100"
          onClick={() => setCurrentBanner((prev) => (prev + 1) % banners.length)}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </section>

      {/* Categories Grid */}
      {categories.length > 0 && (
        <section className="py-8 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
              {categories.slice(0, 8).map((category, index) => (
                <Link
                  key={category.id}
                  to={`/loja/categoria/${category.slug}`}
                  className="group flex flex-col items-center gap-2 p-4 rounded-xl bg-background hover:shadow-lg transition-all hover:-translate-y-1"
                >
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[hsl(var(--store-primary))]/10 to-[hsl(var(--store-accent))]/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                    {categoryIcons[index % categoryIcons.length]}
                  </div>
                  <span className="text-xs font-medium text-center line-clamp-2">
                    {category.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Flash Sale Section */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="bg-gradient-to-r from-[hsl(var(--store-deal))] to-destructive rounded-2xl p-6 mb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-white">
                <div className="p-3 bg-white/20 rounded-xl">
                  <Zap className="h-8 w-8" />
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                    <Flame className="h-6 w-6" />
                    Ofertas Relâmpago
                  </h2>
                  <p className="text-white/80">Aproveite antes que acabe!</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-white">
                <Clock className="h-5 w-5" />
                <div className="flex gap-1">
                  {['12', '34', '56'].map((time, i) => (
                    <span key={i} className="bg-white/20 px-3 py-2 rounded-lg font-mono font-bold text-lg">
                      {time}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {products.slice(0, 5).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Promo Banners Grid */}
      <section className="py-8 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Link
              to="/loja"
              className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-primary/80 p-8 text-primary-foreground group"
            >
              <div className="relative z-10">
                <Badge className="bg-primary-foreground/20 mb-3">Novidade</Badge>
                <h3 className="text-2xl font-bold mb-2">Eletrônicos</h3>
                <p className="text-primary-foreground/80 mb-4">Os melhores gadgets com desconto</p>
                <span className="inline-flex items-center gap-2 font-semibold group-hover:gap-3 transition-all">
                  Ver Produtos <ArrowRight className="h-4 w-4" />
                </span>
              </div>
              <Gift className="absolute right-4 bottom-4 h-32 w-32 text-primary-foreground/10" />
            </Link>
            <Link
              to="/loja"
              className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[hsl(var(--store-accent))] to-[hsl(var(--store-primary))] p-8 text-white group"
            >
              <div className="relative z-10">
                <Badge className="bg-white/20 mb-3">Imperdível</Badge>
                <h3 className="text-2xl font-bold mb-2">Moda Feminina</h3>
                <p className="text-white/80 mb-4">Tendências da estação</p>
                <span className="inline-flex items-center gap-2 font-semibold group-hover:gap-3 transition-all">
                  Ver Produtos <ArrowRight className="h-4 w-4" />
                </span>
              </div>
              <Sparkles className="absolute right-4 bottom-4 h-32 w-32 text-white/10" />
            </Link>
          </div>
        </div>
      </section>

      {/* Trending Products */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[hsl(var(--store-primary))]/10 rounded-lg">
                <TrendingUp className="h-6 w-6 text-[hsl(var(--store-primary))]" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Mais Vendidos</h2>
                <p className="text-sm text-muted-foreground">Os queridinhos dos nossos clientes</p>
              </div>
            </div>
            <Button variant="outline" asChild className="gap-2">
              <Link to="/loja">
                Ver Todos
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
                <ProductCard key={product.id} product={product} />
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

      {/* Newsletter CTA */}
      <section className="py-12 bg-gradient-to-r from-[hsl(var(--store-primary))] to-[hsl(var(--store-accent))]">
        <div className="container mx-auto px-4 text-center text-white">
          <Gift className="h-12 w-12 mx-auto mb-4 opacity-80" />
          <h2 className="text-3xl font-bold mb-2">
            Ganhe 10% OFF na primeira compra!
          </h2>
          <p className="text-white/80 mb-6 max-w-xl mx-auto">
            Cadastre seu e-mail e receba ofertas exclusivas, novidades e promoções.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
            <input
              type="email"
              placeholder="Seu melhor e-mail"
              className="flex-1 px-4 py-3 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-white"
            />
            <Button variant="secondary" size="lg" className="font-semibold">
              Quero meu cupom!
            </Button>
          </div>
        </div>
      </section>
    </StoreLayout>
  );
};

export default HomePage;
