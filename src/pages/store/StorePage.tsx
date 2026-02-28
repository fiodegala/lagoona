import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Search, SlidersHorizontal, X, Package, Grid3X3, LayoutList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import StoreLayout from '@/components/store/StoreLayout';
import ProductCard from '@/components/store/ProductCard';
import { productsService, Product } from '@/services/products';
import { categoriesService, Category } from '@/services/categories';
import { enrichProductsWithStock } from '@/services/stockService';

const ITEMS_PER_PAGE = 12;

const StorePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Derive filter state directly from URL (single source of truth)
  const searchQuery = searchParams.get('busca') || '';
  const selectedCategories = searchParams.get('categorias')?.split(',').filter(Boolean) || [];
  const sortBy = searchParams.get('ordenar') || 'recentes';
  const showOnlyOffers = searchParams.get('ofertas') === 'true';
  const showInStock = searchParams.get('estoque') === 'true';
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [currentPage, setCurrentPage] = useState(1);

  // Reset page when filters change
  const filterKey = `${searchQuery}|${selectedCategories.join(',')}|${sortBy}|${showOnlyOffers}|${showInStock}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setCurrentPage(1);
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        const [productsData, categoriesData] = await Promise.all([
          productsService.getAll(),
          categoriesService.getAll(),
        ]);
        
        const activeProducts = productsData.filter(p => p.is_active);
        const enrichedProducts = await enrichProductsWithStock(activeProducts);
        setProducts(enrichedProducts);
        setCategories(categoriesData.filter(c => c.is_active));
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Helper to update a single URL param
  const updateParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    setSearchParams(params, { replace: true });
  };

  const setSearchQuery = (value: string) => updateParam('busca', value || null);
  const setSortBy = (value: string) => updateParam('ordenar', value === 'recentes' ? null : value);
  const setShowInStock = (checked: boolean) => updateParam('estoque', checked ? 'true' : null);
  const setShowOnlyOffers = (checked: boolean) => updateParam('ofertas', checked ? 'true' : null);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        p => p.name.toLowerCase().includes(query) || 
             p.description?.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (selectedCategories.length > 0) {
      result = result.filter(p => p.category_id && selectedCategories.includes(p.category_id));
    }

    // Offers filter
    if (showOnlyOffers) {
      result = result.filter(p => p.promotional_price && p.promotional_price < p.price);
    }

    // Stock filter
    if (showInStock) {
      result = result.filter(p => p.stock > 0);
    }

    // Price filter
    result = result.filter(p => p.price >= priceRange[0] && p.price <= priceRange[1]);

    // Sorting
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
  }, [products, searchQuery, selectedCategories, sortBy, showOnlyOffers, showInStock, priceRange]);

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const toggleCategory = (categoryId: string) => {
    const newCats = selectedCategories.includes(categoryId)
      ? selectedCategories.filter(id => id !== categoryId)
      : [...selectedCategories, categoryId];
    updateParam('categorias', newCats.length > 0 ? newCats.join(',') : null);
  };

  const clearFilters = () => {
    setPriceRange([0, 10000]);
    setSearchParams({}, { replace: true });
  };

  const activeFiltersCount = 
    (searchQuery ? 1 : 0) + 
    selectedCategories.length + 
    (sortBy !== 'recentes' ? 1 : 0) + 
    (showOnlyOffers ? 1 : 0) +
    (showInStock ? 1 : 0);


  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const filtersContent = (
    <div className="space-y-6">
      {/* Price Range */}
      <div className="space-y-4">
        <h4 className="font-semibold">Faixa de Preço</h4>
        <Slider
          value={priceRange}
          onValueChange={(value) => setPriceRange(value as [number, number])}
          max={10000}
          step={50}
          className="w-full"
        />
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{formatPrice(priceRange[0])}</span>
          <span>{formatPrice(priceRange[1])}</span>
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-3">
        <h4 className="font-semibold">Categorias</h4>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {categories.map((category) => (
            <div key={category.id} className="flex items-center gap-2">
              <Checkbox
                id={`cat-${category.id}`}
                checked={selectedCategories.includes(category.id)}
                onCheckedChange={() => toggleCategory(category.id)}
              />
              <Label htmlFor={`cat-${category.id}`} className="cursor-pointer text-sm">
                {category.name}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Stock filter */}
      <div className="space-y-3">
        <h4 className="font-semibold">Disponibilidade</h4>
        <div className="flex items-center gap-2">
          <Checkbox
            id="in-stock"
            checked={showInStock}
            onCheckedChange={(checked) => setShowInStock(checked as boolean)}
          />
          <Label htmlFor="in-stock" className="cursor-pointer text-sm">
            Apenas em estoque
          </Label>
        </div>
      </div>

      {/* Clear filters */}
      {activeFiltersCount > 0 && (
        <Button variant="outline" onClick={clearFilters} className="w-full">
          Limpar Filtros ({activeFiltersCount})
        </Button>
      )}
    </div>
  );

  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Todos os Produtos</h1>
          <p className="text-muted-foreground mt-1">
            {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''} encontrado{filteredProducts.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Filters bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4 p-4 bg-card rounded-xl border">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar nesta lista..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Sort */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recentes">Mais Recentes</SelectItem>
              <SelectItem value="preco-menor">Menor Preço</SelectItem>
              <SelectItem value="preco-maior">Maior Preço</SelectItem>
              <SelectItem value="nome-az">Nome A-Z</SelectItem>
              <SelectItem value="nome-za">Nome Z-A</SelectItem>
            </SelectContent>
          </Select>

          {/* View mode toggle */}
          <div className="hidden md:flex border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('grid')}
              className="rounded-none"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('list')}
              className="rounded-none"
            >
              <LayoutList className="h-4 w-4" />
            </Button>
          </div>

          {/* Mobile filters button */}
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="outline" className="gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-1">{activeFiltersCount}</Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Filtros</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                {filtersContent}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Active filters badges */}
        {(selectedCategories.length > 0 || showInStock) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {selectedCategories.map(catId => {
              const cat = categories.find(c => c.id === catId);
              return cat ? (
                <Badge key={catId} variant="secondary" className="gap-1 pl-3">
                  {cat.name}
                  <X
                    className="h-3 w-3 cursor-pointer ml-1"
                    onClick={() => toggleCategory(catId)}
                  />
                </Badge>
              ) : null;
            })}
            {showInStock && (
              <Badge variant="secondary" className="gap-1 pl-3">
                Em estoque
                <X
                  className="h-3 w-3 cursor-pointer ml-1"
                  onClick={() => setShowInStock(false)}
                />
              </Badge>
            )}
          </div>
        )}

        <div className="flex gap-6">
          {/* Desktop sidebar filters */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-36 bg-card rounded-xl border p-5">
              <h3 className="font-semibold text-lg mb-4">Filtrar por</h3>
              {filtersContent}
            </div>
          </aside>

          {/* Products grid */}
          <div className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : paginatedProducts.length > 0 ? (
              <>
                <div className={
                  viewMode === 'grid' 
                    ? "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4"
                    : "flex flex-col gap-4"
                }>
                  {paginatedProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-8">
                    <Button
                      variant="outline"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => p - 1)}
                    >
                      Anterior
                    </Button>
                    <div className="flex gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let page: number;
                        if (totalPages <= 5) {
                          page = i + 1;
                        } else if (currentPage <= 3) {
                          page = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          page = totalPages - 4 + i;
                        } else {
                          page = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={page}
                            variant={currentPage === page ? 'default' : 'outline'}
                            size="icon"
                            onClick={() => setCurrentPage(page)}
                          >
                            {page}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => p + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-24 bg-card rounded-xl border">
                <Package className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-lg mb-2">Nenhum produto encontrado</h3>
                <p className="text-muted-foreground mb-4">
                  Tente ajustar os filtros ou buscar por outro termo.
                </p>
                <Button variant="outline" onClick={clearFilters}>
                  Limpar Filtros
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </StoreLayout>
  );
};

export default StorePage;
