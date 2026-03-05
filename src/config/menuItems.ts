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
} from 'lucide-react';

export interface MenuItem {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  key: string; // unique key for permissions
  requireAdmin?: boolean;
}

export const navItems: MenuItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin', key: 'dashboard' },
  { icon: Monitor, label: 'PDV', path: '/admin/pos', key: 'pos' },
  { icon: Package, label: 'Produtos', path: '/admin/products', key: 'products', requireAdmin: true },
  { icon: FolderTree, label: 'Categorias', path: '/admin/categories', key: 'categories', requireAdmin: true },
  { icon: Warehouse, label: 'Estoque', path: '/admin/stock', key: 'stock' },
  { icon: UserPlus, label: 'Clientes', path: '/admin/customers', key: 'customers' },
  { icon: ShoppingCart, label: 'Pedidos', path: '/admin/orders', key: 'orders' },
  { icon: Receipt, label: 'Vendas', path: '/admin/sales', key: 'sales' },
  { icon: ShoppingBasket, label: 'Carrinhos Abandonados', path: '/admin/abandoned-carts', key: 'abandoned-carts' },
  { icon: FileText, label: 'Orçamentos', path: '/admin/orcamentos', key: 'quotes' },
  { icon: Star, label: 'Avaliações', path: '/admin/reviews', key: 'reviews', requireAdmin: true },
  { icon: Tag, label: 'Cupons', path: '/admin/coupons', key: 'coupons', requireAdmin: true },
  { icon: Package, label: 'Combos', path: '/admin/combos', key: 'combos', requireAdmin: true },
  { icon: Target, label: 'Compre Junto', path: '/admin/upsells', key: 'upsells', requireAdmin: true },
  { icon: Truck, label: 'Frete', path: '/admin/shipping', key: 'shipping', requireAdmin: true },
  { icon: ImageIcon, label: 'Banners', path: '/admin/banners', key: 'banners', requireAdmin: true },
  { icon: BarChart3, label: 'Relatórios', path: '/admin/reports', key: 'reports' },
  { icon: Sparkles, label: 'Assistente IA', path: '/admin/assistente', key: 'assistant' },
  { icon: BrainCircuit, label: 'Analytics IA', path: '/admin/analytics', key: 'analytics', requireAdmin: true },
  { icon: Users, label: 'Usuários', path: '/admin/users', key: 'users', requireAdmin: true },
  { icon: History, label: 'Histórico', path: '/admin/audit-logs', key: 'audit-logs', requireAdmin: true },
  { icon: Upload, label: 'Importar CSV', path: '/admin/importar-csv', key: 'import-csv', requireAdmin: true },
  { icon: Upload, label: 'Importar Legado', path: '/admin/importar-legado', key: 'import-legacy', requireAdmin: true },
];

export const settingsItems: MenuItem[] = [
  { icon: Target, label: 'Metas de Vendas', path: '/admin/settings', key: 'settings-goals' },
  { icon: Settings, label: 'Configurações', path: '/admin/settings', key: 'settings' },
];

export const allMenuKeys = [...navItems, ...settingsItems].map(item => item.key);
