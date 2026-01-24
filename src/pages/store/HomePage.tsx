import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2, ShoppingBag, Truck, Shield, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StoreLayout from '@/components/store/StoreLayout';
import ProductCard from '@/components/store/ProductCard';
import { productsService, Product } from '@/services/products';
import { categoriesService, Category } from '@/services/categories';

const HomePage = () => {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [productsData, categoriesData] = await Promise.all([
          productsService.getAll(),
          categoriesService.getAll(),
        ]);
        
        // Get active products, limit to 8 for featured section
        const activeProducts = productsData.filter(p => p.is_active);
        setFeaturedProducts(activeProducts.slice(0, 8));
        setCategories(categoriesData.filter(c => c.is_active));
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);

  const features = [
    {
      icon: Truck,
      title: 'Entrega Rápida',
      description: 'Receba seus produtos com rapidez e segurança',
    },
    {
      icon: Shield,
      title: 'Compra Segura',
      description: 'Seus dados protegidos em todas as transações',
    },
    {
      icon: CreditCard,
      title: 'Parcelamento',
      description: 'Parcele suas compras em até 12x',
    },
    {
      icon: ShoppingBag,
      title: 'Troca Fácil',
      description: '30 dias para trocar ou devolver',
    },
  ];

  return (
    <StoreLayout>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/10 via-background to-accent/10 py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              Bem-vindo à{' '}
              <span className="text-primary">Minha Loja</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              Descubra produtos incríveis com os melhores preços. 
              Qualidade garantida e entrega para todo o Brasil.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild size="lg" className="gap-2">
                <Link to="/loja">
                  Ver Produtos
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/loja">
                  Explorar Categorias
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-12 border-b">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="flex flex-col items-center text-center gap-2">
                <div className="p-3 rounded-full bg-primary/10">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-medium text-sm">{feature.title}</h3>
                <p className="text-xs text-muted-foreground hidden md:block">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="py-12">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold">Categorias</h2>
              <Button variant="ghost" asChild className="gap-2">
                <Link to="/loja">
                  Ver todas
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {categories.slice(0, 6).map((category) => (
                <Link
                  key={category.id}
                  to={`/loja/categoria/${category.slug}`}
                  className="group p-6 rounded-lg bg-muted/50 hover:bg-primary/10 text-center transition-colors"
                >
                  <h3 className="font-medium group-hover:text-primary transition-colors">
                    {category.name}
                  </h3>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured Products */}
      <section className="py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">Produtos em Destaque</h2>
            <Button variant="ghost" asChild className="gap-2">
              <Link to="/loja">
                Ver todos
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : featuredProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {featuredProducts.map((product) => (
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

      {/* CTA Section */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Pronto para encontrar o produto perfeito?
          </h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            Explore nossa coleção completa e encontre exatamente o que você precisa.
          </p>
          <Button asChild size="lg" variant="secondary" className="gap-2">
            <Link to="/loja">
              Explorar Loja
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </StoreLayout>
  );
};

export default HomePage;
