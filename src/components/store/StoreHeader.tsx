import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Menu, User, Heart, Sun, Moon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { useFavorites } from '@/contexts/FavoritesContext';
import { Category } from '@/services/categories';
import { supabase } from '@/integrations/supabase/client';
import CartDrawer from '@/components/store/CartDrawer';
import logoLagoona from '@/assets/logo-lagoona.png';
import logoLagoonaDark from '@/assets/logo-lagoona-dark.png';

interface SearchResult {
  id: string;
  name: string;
  image_url: string | null;
  price: number;
  promotional_price: number | null;
}

interface StoreHeaderProps {
  categories: Category[];
}

const StoreHeader = ({ categories }: StoreHeaderProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { favorites } = useFavorites();
  const favoritesCount = favorites.length;

  const searchProducts = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const { data } = await supabase
        .from('products')
        .select('id, name, image_url, price, promotional_price')
        .eq('is_active', true)
        .ilike('name', `%${query.trim()}%`)
        .limit(8);
      setSuggestions(data || []);
      setShowSuggestions(true);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchInput = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    searchTimerRef.current = setTimeout(() => searchProducts(value), 250);
  }, [searchProducts]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/loja?busca=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setShowSuggestions(false);
      setSuggestions([]);
    }
  };

  const handleSelectProduct = (id: string) => {
    navigate(`/produto/${id}`);
    setSearchOpen(false);
    setShowSuggestions(false);
    setSearchQuery('');
    setSuggestions([]);
    setMobileMenuOpen(false);
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

  const SuggestionsList = () => {
    if (!showSuggestions || (suggestions.length === 0 && !isSearching && searchQuery.trim().length < 2)) return null;
    return (
      <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border rounded-lg shadow-xl max-h-[400px] overflow-y-auto">
        {isSearching ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : suggestions.length > 0 ? (
          <>
            {suggestions.map((product) => {
              const hasPromo = product.promotional_price && product.promotional_price < product.price;
              return (
                <button
                  key={product.id}
                  type="button"
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-muted/60 transition-colors text-left"
                  onClick={() => handleSelectProduct(product.id)}
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">Sem foto</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <div className="flex items-center gap-2">
                      {hasPromo ? (
                        <>
                          <span className="text-xs line-through text-muted-foreground">{formatPrice(product.price)}</span>
                          <span className="text-sm font-semibold text-store-deal">{formatPrice(product.promotional_price!)}</span>
                        </>
                      ) : (
                        <span className="text-sm font-semibold">{formatPrice(product.price)}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
            <button
              type="button"
              className="w-full px-4 py-3 text-sm text-center text-store-primary hover:bg-muted/60 transition-colors border-t font-medium"
              onClick={() => { handleSearch({ preventDefault: () => {} } as React.FormEvent); }}
            >
              Ver todos os resultados para "{searchQuery}"
            </button>
          </>
        ) : searchQuery.trim().length >= 2 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhum produto encontrado para "{searchQuery}"
          </div>
        ) : null}
      </div>
    );
  };

  const toggleTheme = () => {
    const root = document.documentElement;
    if (root.classList.contains('dark')) {
      root.classList.remove('dark');
      setIsDark(false);
    } else {
      root.classList.add('dark');
      setIsDark(true);
    }
  };

  const activeCategories = categories.filter(c => c.is_active);

  const navLinks = [
    { label: 'Home', to: '/' },
    { label: 'Loja', to: '/loja' },
    { label: 'Lançamentos', to: '/loja?ordenar=recentes' },
    { label: 'Ofertas', to: '/loja?ofertas=true' },
    { label: 'Combos', to: '/combos' },
    { label: 'Categorias', to: '/categorias' },
    { label: 'Atacado', to: '/atacado' },
    { label: 'Contato', to: '/contato' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center shrink-0">
            <img
              src={logoLagoonaDark}
              alt="Fio de Gala"
              className="h-8 sm:h-10 dark:hidden"
            />
            <img
              src={logoLagoona}
              alt="Fio de Gala"
              className="h-8 sm:h-10 hidden dark:block"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                className="px-4 py-2 text-xs font-medium tracking-[0.1em] uppercase text-foreground/70 hover:text-store-gold transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-1">
            {/* Search */}
            <Button
              variant="ghost"
              size="icon"
              className="text-foreground/70 hover:text-foreground"
              onClick={() => setSearchOpen(!searchOpen)}
            >
              <Search className="h-5 w-5" />
            </Button>

            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="text-foreground/70 hover:text-foreground"
              onClick={toggleTheme}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            {/* Favorites */}
            <Button variant="ghost" size="icon" asChild className="relative text-foreground/70 hover:text-foreground hidden sm:flex">
              <Link to="/favoritos">
                <Heart className="h-5 w-5" />
                {favoritesCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs bg-store-gold text-store-dark">
                    {favoritesCount > 99 ? '99+' : favoritesCount}
                  </Badge>
                )}
              </Link>
            </Button>

            {/* Account */}
            <Button variant="ghost" size="icon" asChild className="hidden sm:flex text-foreground/70 hover:text-foreground">
              <Link to="/minha-conta">
                <User className="h-5 w-5" />
              </Link>
            </Button>

            {/* Cart Drawer */}
            <CartDrawer />

            {/* Mobile menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon" className="text-foreground/70">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0">
                <div className="flex flex-col h-full">
                  <div className="p-4 border-b flex items-center justify-center">
                    <img src={logoLagoonaDark} alt="Fio de Gala" className="h-8" />
                  </div>

                  <div className="p-4 border-b">
                    <form onSubmit={(e) => { handleSearch(e); setMobileMenuOpen(false); }}>
                      <div className="relative" ref={suggestionsRef}>
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="search"
                          placeholder="Buscar..."
                          value={searchQuery}
                          onChange={(e) => handleSearchInput(e.target.value)}
                          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                          className="pl-10"
                        />
                        <SuggestionsList />
                      </div>
                    </form>
                  </div>

                  <nav className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-1">
                      {navLinks.map((link) => (
                        <Link
                          key={link.label}
                          to={link.to}
                          className="block px-4 py-3 rounded-lg hover:bg-muted transition-colors font-medium"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          {link.label}
                        </Link>
                      ))}
                      <div className="pt-4 pb-1 px-4 text-xs font-semibold text-muted-foreground uppercase">
                        Categorias
                      </div>
                      {activeCategories.map((category) => (
                        <Link
                          key={category.id}
                          to={`/loja/categoria/${category.slug}`}
                          className="block px-4 py-3 rounded-lg hover:bg-muted transition-colors text-sm"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          {category.name}
                        </Link>
                      ))}
                    </div>
                  </nav>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Search Bar Dropdown */}
      {searchOpen && (
        <div className="border-t bg-background">
          <div className="container mx-auto px-4 py-3">
            <form onSubmit={handleSearch} className="max-w-xl mx-auto">
              <div className="relative" ref={suggestionsRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="O que você procura?"
                  value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  className="pl-10"
                  autoFocus
                />
                <SuggestionsList />
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};

export default StoreHeader;
