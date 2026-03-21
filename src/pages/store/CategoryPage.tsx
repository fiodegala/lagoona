import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, Package, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StoreLayout from '@/components/store/StoreLayout';
import ProductCard from '@/components/store/ProductCard';
import { productsService, Product } from '@/services/products';
import { categoriesService, Category } from '@/services/categories';
import { enrichProductsWithStock } from '@/services/stockService';
import { useProductCardsMeta } from '@/hooks/useProductCardsMeta';

const ITEMS_PER_PAGE = 12;

const CategoryPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState('recentes');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const loadData = async () => {
      if (!slug) return;
      
      try {
        setIsLoading(true);
        const [productsData, categoriesData] = await Promise.all([
          productsService.getAll(),
          categoriesService.getAll(),
        ]);
        
        const foundCategory = categoriesData.find(c => c.slug === slug);
        setCategory(foundCategory || null);
        
        if (foundCategory) {
          const categoryProducts = productsData.filter(
            p => p.is_active && p.category_id === foundCategory.id
          );
          const enriched = await enrichProductsWithStock(categoryProducts);
          setProducts(enriched);
        }
      } catch (error) {
        console.error('Error loading category:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
    setCurrentPage(1);
  }, [slug]);

  // Sort products
  const sortedProducts = useMemo(() => {
    let result = [...products];

    switch (sortBy) {
      case 'preco-menor':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'preco-maior':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'nome-az':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'nome-za':
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'recentes':
      default:
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return result;
  }, [products, sortBy]);

  // Pagination
  const totalPages = Math.ceil(sortedProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = sortedProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const pageProductIds = useMemo(() => paginatedProducts.map(p => p.id), [paginatedProducts]);
  const { meta: productsMeta } = useProductCardsMeta(pageProductIds);

  if (isLoading) {
    return (
      <StoreLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </StoreLayout>
    );
  }

  if (!category) {
    return (
      <StoreLayout>
        <div className="container mx-auto px-4 py-24 text-center">
          <Package className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Categoria não encontrada</h1>
          <p className="text-muted-foreground mb-6">
            A categoria que você procura não existe ou foi removida.
          </p>
          <Button asChild>
            <Link to="/loja">Ver todos os produtos</Link>
          </Button>
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-foreground transition-colors">
            Início
          </Link>
          <ChevronRight className="h-4 w-4" />
          <Link to="/loja" className="hover:text-foreground transition-colors">
            Loja
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">{category.name}</span>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{category.name}</h1>
          {category.description && (
            <p className="text-muted-foreground mt-2">{category.description}</p>
          )}
          <p className="text-sm text-muted-foreground mt-2">
            {sortedProducts.length} produto{sortedProducts.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Sort */}
        <div className="flex justify-end mb-6">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-48 h-12 md:h-10 text-base md:text-sm">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recentes" className="py-3 md:py-1.5 text-base md:text-sm">Mais Recentes</SelectItem>
              <SelectItem value="preco-menor" className="py-3 md:py-1.5 text-base md:text-sm">Menor Preço</SelectItem>
              <SelectItem value="preco-maior" className="py-3 md:py-1.5 text-base md:text-sm">Maior Preço</SelectItem>
              <SelectItem value="nome-az" className="py-3 md:py-1.5 text-base md:text-sm">Nome A-Z</SelectItem>
              <SelectItem value="nome-za" className="py-3 md:py-1.5 text-base md:text-sm">Nome Z-A</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Products grid */}
        {paginatedProducts.length > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {paginatedProducts.map((product) => (
                <ProductCard key={product.id} product={product} meta={productsMeta[product.id]} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="h-12 md:h-10 px-5 md:px-4 text-base md:text-sm"
                >
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground px-4">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="h-12 md:h-10 px-5 md:px-4 text-base md:text-sm"
                >
                  Próxima
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-24">
            <Package className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="font-medium text-lg mb-2">Nenhum produto nesta categoria</h3>
            <p className="text-muted-foreground mb-6">
              Esta categoria ainda não possui produtos disponíveis.
            </p>
            <Button asChild variant="outline">
              <Link to="/loja">Ver todos os produtos</Link>
            </Button>
          </div>
        )}
      </div>
    </StoreLayout>
  );
};

export default CategoryPage;
