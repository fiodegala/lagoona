import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Search, Menu, X, User, Heart, ChevronDown, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
    <header className="sticky top-0 z-50">
      {/* Announcement Bar */}
      <div className="bg-gradient-to-r from-[hsl(var(--store-primary))] to-[hsl(var(--store-accent))] text-white py-2 px-4">
        <div className="container mx-auto flex items-center justify-center gap-2 text-sm font-medium">
          <Zap className="h-4 w-4" />
          <span>🔥 FRETE GRÁTIS em compras acima de R$199 | Use o cupom: PRIMEIRA10</span>
          <Zap className="h-4 w-4" />
        </div>
      </div>

      {/* Main Header */}
      <div className="bg-background border-b shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-4 h-16">
            {/* Mobile menu button */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0">
                <div className="flex flex-col h-full">
                  <div className="p-4 border-b bg-gradient-to-r from-[hsl(var(--store-primary))] to-[hsl(var(--store-accent))]">
                    <span className="font-bold text-xl text-white">Minha Loja</span>
                  </div>
                  
                  {/* Mobile Search */}
                  <div className="p-4 border-b">
                    <form onSubmit={(e) => { handleSearch(e); setMobileMenuOpen(false); }}>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="search"
                          placeholder="O que você procura?"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </form>
                  </div>

                  {/* Mobile Navigation */}
                  <nav className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-1">
                      <Link
                        to="/loja"
                        className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent transition-colors font-medium"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Todos os Produtos
                      </Link>
                      <div className="pt-2 pb-1 px-4 text-xs font-semibold text-muted-foreground uppercase">
                        Categorias
                      </div>
                      {activeCategories.map((category) => (
                        <Link
                          key={category.id}
                          to={`/loja/categoria/${category.slug}`}
                          className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent transition-colors"
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

            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(var(--store-primary))] to-[hsl(var(--store-accent))] flex items-center justify-center">
                <span className="text-white font-bold text-lg">M</span>
              </div>
              <span className="hidden sm:block font-bold text-xl bg-gradient-to-r from-[hsl(var(--store-primary))] to-[hsl(var(--store-accent))] bg-clip-text text-transparent">
                Minha Loja
              </span>
            </Link>

            {/* Search - Desktop */}
            <form onSubmit={handleSearch} className="hidden lg:flex flex-1 max-w-2xl mx-4">
              <div className="relative w-full flex">
                <Input
                  type="search"
                  placeholder="Buscar produtos, marcas e muito mais..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-r-none border-r-0 h-11 text-base focus-visible:ring-[hsl(var(--store-primary))]"
                />
                <Button 
                  type="submit" 
                  className="rounded-l-none h-11 px-6 bg-[hsl(var(--store-primary))] hover:bg-[hsl(var(--store-primary))]/90"
                >
                  <Search className="h-5 w-5" />
                </Button>
              </div>
            </form>

            {/* Actions */}
            <div className="flex items-center gap-1 ml-auto">
              {/* Account */}
              <Button variant="ghost" size="sm" className="hidden sm:flex gap-2 text-muted-foreground hover:text-foreground">
                <User className="h-5 w-5" />
                <span className="hidden md:inline">Entrar</span>
              </Button>

              {/* Wishlist */}
              <Button variant="ghost" size="icon" className="hidden sm:flex text-muted-foreground hover:text-foreground">
                <Heart className="h-5 w-5" />
              </Button>

              {/* Cart */}
              <Button variant="ghost" size="icon" asChild className="relative">
                <Link to="/carrinho">
                  <ShoppingCart className="h-5 w-5" />
                  {itemCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs bg-[hsl(var(--store-primary))]">
                      {itemCount > 99 ? '99+' : itemCount}
                    </Badge>
                  )}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Categories Navigation - Desktop */}
      <nav className="hidden lg:block bg-card border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-1 h-12 overflow-x-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 font-semibold text-[hsl(var(--store-primary))]">
                  <Menu className="h-4 w-4" />
                  Categorias
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {activeCategories.map((category) => (
                  <DropdownMenuItem key={category.id} asChild>
                    <Link to={`/loja/categoria/${category.slug}`}>
                      {category.name}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="h-6 w-px bg-border mx-2" />

            <Link
              to="/loja"
              className="px-4 py-2 text-sm font-medium rounded-md hover:bg-accent transition-colors whitespace-nowrap"
            >
              Ofertas do Dia
            </Link>
            <Link
              to="/loja?ordenar=recentes"
              className="px-4 py-2 text-sm rounded-md hover:bg-accent transition-colors whitespace-nowrap"
            >
              Novidades
            </Link>
            <Link
              to="/loja?ordenar=preco-menor"
              className="px-4 py-2 text-sm rounded-md hover:bg-accent transition-colors whitespace-nowrap"
            >
              Mais Vendidos
            </Link>
            {activeCategories.slice(0, 5).map((category) => (
              <Link
                key={category.id}
                to={`/loja/categoria/${category.slug}`}
                className="px-4 py-2 text-sm rounded-md hover:bg-accent transition-colors whitespace-nowrap"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </header>
  );
};

export default StoreHeader;
