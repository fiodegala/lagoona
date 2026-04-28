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
  BookOpen,
  DollarSign,
  ClipboardList,
  Megaphone,
  Zap,
  TrendingUp,
  Eye,
  Database,
  KeyRound,
  FileCode2,
  MessageSquare,
  Calendar,
} from 'lucide-react';

export interface MenuItem {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  menuKey: string;
  requireAdmin?: boolean;
}

export const alwaysVisibleMenuKeys = ['manual', 'service-orders', 'announcements'] as const;

export type AlwaysVisibleMenuKey = (typeof alwaysVisibleMenuKeys)[number];

export const isAlwaysVisibleMenu = (menuKey: string) =>
  alwaysVisibleMenuKeys.includes(menuKey as AlwaysVisibleMenuKey);

export const normalizeAllowedMenuKeys = (menus?: string[] | null) =>
  Array.from(new Set([...(menus ?? []), ...alwaysVisibleMenuKeys]));

export const stripAlwaysVisibleMenuKeys = (menus?: string[] | null) =>
  (menus ?? []).filter((menuKey) => !isAlwaysVisibleMenu(menuKey));

export const navItems: MenuItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin', menuKey: 'dashboard' },
  { icon: Monitor, label: 'PDV', path: '/admin/pos', menuKey: 'pos' },
  { icon: ClipboardList, label: 'Ordens de Serviço', path: '/admin/ordens-servico', menuKey: 'service-orders' },
  { icon: Megaphone, label: 'Comunicados', path: '/admin/comunicados', menuKey: 'announcements' },
  { icon: Package, label: 'Produtos', path: '/admin/products', menuKey: 'products', requireAdmin: true },
  { icon: DollarSign, label: 'Valores de Produtos', path: '/admin/valores-produtos', menuKey: 'product-pricing' },
  { icon: FolderTree, label: 'Categorias', path: '/admin/categories', menuKey: 'categories', requireAdmin: true },
  { icon: Warehouse, label: 'Estoque', path: '/admin/stock', menuKey: 'stock' },
  { icon: BarChart3, label: 'Distribuição Estoque', path: '/admin/distribuicao-estoque', menuKey: 'stock-distribution' },
  { icon: TrendingUp, label: 'Curva ABC', path: '/admin/curva-abc', menuKey: 'abc-curve', requireAdmin: true },
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
  { icon: Receipt, label: 'Relatório de Caixa', path: '/admin/relatorio-caixa', menuKey: 'cash-report' },
  { icon: Sparkles, label: 'Assistente IA', path: '/admin/assistente', menuKey: 'assistant' },
  { icon: BrainCircuit, label: 'Analytics IA', path: '/admin/analytics', menuKey: 'analytics', requireAdmin: true },
  { icon: Users, label: 'Usuários', path: '/admin/users', menuKey: 'users', requireAdmin: true },
  { icon: History, label: 'Histórico', path: '/admin/audit-logs', menuKey: 'audit-logs', requireAdmin: true },
  { icon: Handshake, label: 'Afiliados', path: '/admin/afiliados', menuKey: 'affiliates', requireAdmin: true },
  { icon: Zap, label: 'Olist', path: '/admin/olist', menuKey: 'olist', requireAdmin: true },
  { icon: Upload, label: 'Importar CSV', path: '/admin/importar-csv', menuKey: 'import-csv', requireAdmin: true },
  { icon: Upload, label: 'Importar Legado', path: '/admin/importar-legado', menuKey: 'import-legacy', requireAdmin: true },
  { icon: Upload, label: 'Importar Dados (BI)', path: '/admin/importar-dados', menuKey: 'import-data', requireAdmin: true },
  { icon: Eye, label: 'Visual de Loja', path: '/admin/vm', menuKey: 'visual-merchandising' },
  { icon: MessageSquare, label: 'Chat Interno', path: '/admin/chat', menuKey: 'internal-chat' },
  { icon: Calendar, label: 'Agenda', path: '/admin/agenda', menuKey: 'calendar' },
  { icon: BookOpen, label: 'Manual', path: '/admin/manual', menuKey: 'manual' },
];

export const settingsItems: MenuItem[] = [
  { icon: Target, label: 'Metas de Vendas', path: '/admin/settings', menuKey: 'settings-goals' },
  { icon: Settings, label: 'Configurações', path: '/admin/settings', menuKey: 'settings' },
  { icon: KeyRound, label: 'API Keys', path: '/admin/settings/api-keys', menuKey: 'api-keys', requireAdmin: true },
  { icon: FileCode2, label: 'Documentação API', path: '/admin/settings/api-docs', menuKey: 'api-docs', requireAdmin: true },
  { icon: Database, label: 'Exportar Banco', path: '/admin/database-export', menuKey: 'database-export', requireAdmin: true },
];

export const allMenuItems = [...navItems, ...settingsItems];
export const allMenuKeys = allMenuItems.map(item => item.menuKey);
