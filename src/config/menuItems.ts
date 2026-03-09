import {
  LayoutDashboard,
  Package,
  Upload,
  FolderTree,
  ShoppingCart,
  Settings,
  Users,
  BarChart3,
  BrainCircuit,
  Star,
  Tag,
  Monitor,
  Target,
  Receipt,
  UserPlus,
  Warehouse,
  Truck,
  Image as ImageIcon,
  ShoppingBasket,
  History,
  Sparkles,
  FileText,
  Handshake,
} from 'lucide-react';

export interface MenuItem {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  menuKey: string;
  requireAdmin?: boolean;
}

export const navItems: MenuItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin', menuKey: 'dashboard' },
  { icon: Monitor, label: 'PDV', path: '/admin/pos', menuKey: 'pos' },
  { icon: Package, label: 'Produtos', path: '/admin/products', menuKey: 'products', requireAdmin: true },
  { icon: FolderTree, label: 'Categorias', path: '/admin/categories', menuKey: 'categories', requireAdmin: true },
  { icon: Warehouse, label: 'Estoque', path: '/admin/stock', menuKey: 'stock' },
  { icon: UserPlus, label: 'Clientes', path: '/admin/customers', menuKey: 'customers' },
  { icon: ShoppingCart, label: 'Pedidos', path: '/admin/orders', menuKey: 'orders' },
  { icon: Receipt, label: 'Vendas', path: '/admin/sales', menuKey: 'sales' },
  { icon: ShoppingBasket, label: 'Carrinhos Abandonados', path: '/admin/abandoned-carts', menuKey: 'abandoned-carts' },
  { icon: FileText, label: 'Orçamentos', path: '/admin/orcamentos', menuKey: 'quotes' },
  { icon: Star, label: 'Avaliações', path: '/admin/reviews', menuKey: 'reviews', requireAdmin: true },
  { icon: Tag, label: 'Cupons', path: '/admin/coupons', menuKey: 'coupons', requireAdmin: true },
  { icon: Package, label: 'Combos', path: '/admin/combos', menuKey: 'combos', requireAdmin: true },
  { icon: Target, label: 'Compre Junto', path: '/admin/upsells', menuKey: 'upsells', requireAdmin: true },
  { icon: Truck, label: 'Frete', path: '/admin/shipping', menuKey: 'shipping', requireAdmin: true },
  { icon: ImageIcon, label: 'Banners', path: '/admin/banners', menuKey: 'banners', requireAdmin: true },
  { icon: BarChart3, label: 'Relatórios', path: '/admin/reports', menuKey: 'reports' },
  { icon: Sparkles, label: 'Assistente IA', path: '/admin/assistente', menuKey: 'assistant' },
  { icon: BrainCircuit, label: 'Analytics IA', path: '/admin/analytics', menuKey: 'analytics', requireAdmin: true },
  { icon: Users, label: 'Usuários', path: '/admin/users', menuKey: 'users', requireAdmin: true },
  { icon: History, label: 'Histórico', path: '/admin/audit-logs', menuKey: 'audit-logs', requireAdmin: true },
  { icon: Handshake, label: 'Afiliados', path: '/admin/afiliados', menuKey: 'affiliates', requireAdmin: true },
  { icon: Upload, label: 'Importar CSV', path: '/admin/importar-csv', menuKey: 'import-csv', requireAdmin: true },
  { icon: Upload, label: 'Importar Legado', path: '/admin/importar-legado', menuKey: 'import-legacy', requireAdmin: true },
];

export const settingsItems: MenuItem[] = [
  { icon: Target, label: 'Metas de Vendas', path: '/admin/settings', menuKey: 'settings-goals' },
  { icon: Settings, label: 'Configurações', path: '/admin/settings', menuKey: 'settings' },
];

export const allMenuItems = [...navItems, ...settingsItems];
export const allMenuKeys = allMenuItems.map(item => item.menuKey);
