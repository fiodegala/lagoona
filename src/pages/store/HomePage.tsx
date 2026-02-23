import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2, ShoppingBag, Truck, RefreshCw, Shield, MessageCircle, TrendingUp } from 'lucide-react';
import atacadoVideo from '@/assets/atacado-fdg.mp4';
import { Button } from '@/components/ui/button';
import StoreLayout from '@/components/store/StoreLayout';
import ProductCard from '@/components/store/ProductCard';
import { productsService, Product } from '@/services/products';
import { categoriesService, Category } from '@/services/categories';

const HomePage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [productsData, categoriesData] = await Promise.all([
          productsService.getAll(),
          categoriesService.getAll(),
        ]);
        setProducts(productsData.filter(p => p.is_active));
        setCategories(categoriesData.filter(c => c.is_active));
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const newProducts = [...products].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const categoryIcons = ['👕', '👖', '👟', '👜', '💍', '🎮', '📱', '🏠'];

  return (
    <StoreLayout>
      {/* Hero Section */}
      <section className="relative h-[500px] md:h-[600px] lg:h-[700px] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1920&q=80')`,
          }}
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
                Descubra peças exclusivas confeccionadas com os melhores materiais. Qualidade premium para quem não abre mão de estilo.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button asChild size="lg" className="gap-2 bg-store-gold text-store-dark hover:bg-store-gold/90 font-semibold text-base px-8 tracking-wide">
                  <Link to="/loja">
                    Comprar agora
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="gap-2 border-white/30 text-white hover:bg-white/10 font-semibold text-base px-8 tracking-wide">
                  <Link to="/loja?ordenar=recentes">
                    Ver lançamentos
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
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

      {/* Lançamentos */}
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
              {newProducts.slice(0, 5).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
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
                <Link to="/loja">
                  Ver todas
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="flex flex-wrap justify-center gap-4">
              {categories.slice(0, 8).map((category, index) => (
                <Link
                  key={category.id}
                  to={`/loja/categoria/${category.slug}`}
                  className="group w-32 sm:w-36 md:w-40 flex flex-col items-center gap-3 p-5 rounded-xl bg-background hover:shadow-lg transition-all hover:-translate-y-1"
                >
                  <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden group-hover:scale-110 transition-transform">
                    {category.image_url ? (
                      <img src={category.image_url} alt={category.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl">{categoryIcons[index % categoryIcons.length]}</span>
                    )}
                  </div>
                  <span className="text-sm font-medium text-center line-clamp-2">{category.name}</span>
                </Link>
              ))}
            </div>

            <div className="mt-6 text-center sm:hidden">
              <Button variant="outline" asChild className="gap-2">
                <Link to="/loja">
                  Ver todas as categorias
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
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
                <Link to="/contato">
                  Saiba mais
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="flex-shrink-0">
              <video
                src={atacadoVideo}
                controls
                autoPlay
                loop
                muted
                playsInline
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
