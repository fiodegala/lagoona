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
  Shield,
} from 'lucide-react';
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
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Package, label: 'Produtos', path: '/products' },
  { icon: FolderTree, label: 'Categorias', path: '/categories' },
  { icon: ShoppingCart, label: 'Pedidos', path: '/orders' },
  { icon: BarChart3, label: 'Relatórios', path: '/reports' },
  { icon: Users, label: 'Usuários', path: '/users', requireAdmin: true },
];

const settingsItems = [
  { icon: Key, label: 'API Keys', path: '/settings/api-keys' },
  { icon: Settings, label: 'Configurações', path: '/settings' },
];

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, roles, signOut, isAdmin } = useAuth();

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
            <div className="gradient-primary p-1.5 rounded-lg">
              <Shield className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            <span className="font-bold text-sidebar-foreground">Admin</span>
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
                  <p className="text-xs text-sidebar-foreground/60 truncate capitalize">
                    {roles[0] || 'Sem role'}
                  </p>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')}>
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
          <div className="gradient-primary p-1.5 rounded-lg">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold">Admin</span>
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
          'transition-all duration-300 pt-14 lg:pt-0',
          collapsed ? 'lg:pl-16' : 'lg:pl-64'
        )}
      >
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
};

export default AdminLayout;
