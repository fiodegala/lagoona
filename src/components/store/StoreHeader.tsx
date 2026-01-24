import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Search, Menu, X, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useCart } from '@/contexts/CartContext';
import { Category } from '@/services/categories';

interface StoreHeaderProps {
  categories: Category[];
}

const StoreHeader = ({ categories }: StoreHeaderProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { getItemCount } = useCart();
  const itemCount = getItemCount();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/loja?busca=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const activeCategories = categories.filter(c => c.is_active);

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="container mx-auto px-4">
        {/* Top bar */}
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-bold text-xl shrink-0">
            <Store className="h-6 w-6 text-primary" />
            <span className="hidden sm:inline">Minha Loja</span>
          </Link>

          {/* Search - Desktop */}
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar produtos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
          </form>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Cart */}
            <Button variant="ghost" size="icon" asChild className="relative">
              <Link to="/carrinho">
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                    {itemCount > 99 ? '99+' : itemCount}
                  </Badge>
                )}
              </Link>
            </Button>

            {/* Mobile menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <div className="flex flex-col gap-6 mt-6">
                  {/* Mobile Search */}
                  <form onSubmit={(e) => { handleSearch(e); setMobileMenuOpen(false); }}>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="search"
                        placeholder="Buscar produtos..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </form>

                  {/* Mobile Navigation */}
                  <nav className="flex flex-col gap-2">
                    <Link
                      to="/loja"
                      className="px-4 py-2 rounded-md hover:bg-accent transition-colors font-medium"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Todos os Produtos
                    </Link>
                    {activeCategories.map((category) => (
                      <Link
                        key={category.id}
                        to={`/loja/categoria/${category.slug}`}
                        className="px-4 py-2 rounded-md hover:bg-accent transition-colors"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {category.name}
                      </Link>
                    ))}
                  </nav>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Categories navigation - Desktop */}
        <nav className="hidden md:flex items-center gap-1 py-2 overflow-x-auto">
          <Link
            to="/loja"
            className="px-3 py-1.5 text-sm font-medium rounded-md hover:bg-accent transition-colors whitespace-nowrap"
          >
            Todos os Produtos
          </Link>
          {activeCategories.slice(0, 8).map((category) => (
            <Link
              key={category.id}
              to={`/loja/categoria/${category.slug}`}
              className="px-3 py-1.5 text-sm rounded-md hover:bg-accent transition-colors whitespace-nowrap"
            >
              {category.name}
            </Link>
          ))}
          {activeCategories.length > 8 && (
            <span className="px-3 py-1.5 text-sm text-muted-foreground">
              +{activeCategories.length - 8} mais
            </span>
          )}
        </nav>
      </div>
    </header>
  );
};

export default StoreHeader;
