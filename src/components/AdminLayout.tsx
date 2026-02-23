import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingCart,
  Key,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Users,
  BarChart3,
  Menu,
  X,
  Star,
  Tag,
  Monitor,
  Target,
  ExternalLink,
  UserPlus,
  Warehouse,
} from 'lucide-react';
import logoLagoona from '@/assets/logo-lagoona-white.png';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
  { icon: Monitor, label: 'PDV', path: '/admin/pos' },
  { icon: Package, label: 'Produtos', path: '/admin/products' },
  { icon: FolderTree, label: 'Categorias', path: '/admin/categories' },
  { icon: Warehouse, label: 'Estoque', path: '/admin/stock' },
  { icon: UserPlus, label: 'Clientes', path: '/admin/customers' },
  { icon: ShoppingCart, label: 'Pedidos', path: '/admin/orders' },
  { icon: Star, label: 'Avaliações', path: '/admin/reviews' },
  { icon: Tag, label: 'Cupons', path: '/admin/coupons' },
  { icon: BarChart3, label: 'Relatórios', path: '/admin/reports' },
  { icon: Users, label: 'Usuários', path: '/admin/users', requireAdmin: true },
];

const settingsItems = [
  { icon: Key, label: 'API Keys', path: '/admin/settings/api-keys' },
  { icon: Target, label: 'Metas de Vendas', path: '/admin/settings' },
  { icon: Settings, label: 'Configurações', path: '/admin/settings' },
];

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, roles, signOut, isAdmin, userStore } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const NavItem = ({ icon: Icon, label, path, requireAdmin }: typeof navItems[0]) => {
    if (requireAdmin && !isAdmin) return null;
    
    const isActive = location.pathname === path;
    
    return (
      <Link
        to={path}
        onClick={() => setMobileOpen(false)}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
          isActive
            ? 'bg-sidebar-primary text-sidebar-primary-foreground'
            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
        )}
      >
        <Icon className={cn('h-5 w-5 flex-shrink-0', collapsed && 'mx-auto')} />
        {!collapsed && <span className="font-medium">{label}</span>}
      </Link>
    );
  };

  const Sidebar = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div
      className={cn(
        'flex flex-col h-full bg-sidebar',
        isMobile ? 'w-64' : collapsed ? 'w-16' : 'w-64',
        'transition-all duration-300'
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <img src={logoLagoona} alt="Lagoona" className="h-8 w-auto" />
          </div>
        )}
        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="text-sidebar-foreground hover:bg-sidebar-accent h-8 w-8"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {/* Visit Website Button */}
      <div className="px-2 py-2 border-b border-sidebar-border">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
            'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            'bg-sidebar-primary/10'
          )}
        >
          <ExternalLink className={cn('h-5 w-5 flex-shrink-0', collapsed && !isMobile && 'mx-auto')} />
          {(!collapsed || isMobile) && <span className="font-medium">Visitar Loja</span>}
        </a>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {navItems.map((item) => (
          <NavItem key={item.path} {...item} />
        ))}

        <Separator className="my-4 bg-sidebar-border" />

        {!collapsed && (
          <span className="px-3 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
            Configurações
          </span>
        )}
        
        <div className="space-y-1 mt-2">
          {settingsItems.map((item) => (
            <NavItem key={item.path} {...item} />
          ))}
        </div>
      </div>

      {/* User */}
      <div className="border-t border-sidebar-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'flex items-center gap-3 w-full p-2 rounded-lg transition-colors',
                'hover:bg-sidebar-accent text-sidebar-foreground'
              )}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                  {profile?.full_name ? getInitials(profile.full_name) : 'U'}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium truncate">{profile?.full_name || 'Usuário'}</p>
                  <p className="text-xs text-sidebar-foreground/60 truncate">
                    {userStore?.name || 'Todas as lojas'} • <span className="capitalize">{roles[0] || 'Sem role'}</span>
                  </p>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/admin/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-card border-b z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <img src={logoLagoona} alt="Lagoona" className="h-6 w-auto" />
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-foreground/20 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={cn(
          'lg:hidden fixed inset-y-0 left-0 z-50 transform transition-transform duration-300',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <Sidebar isMobile />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:z-40">
        <Sidebar />
      </div>

      {/* Main content */}
      <main
        className={cn(
          'transition-all duration-300 pt-14 lg:pt-0 min-h-screen',
          collapsed ? 'lg:pl-16' : 'lg:pl-64'
        )}
      >
        <div className="p-6 lg:p-8 h-full overflow-y-auto">{children}</div>
      </main>
    </div>
  );
};

export default AdminLayout;
