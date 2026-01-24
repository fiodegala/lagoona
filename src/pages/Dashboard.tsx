import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Package, ShoppingCart, Key, TrendingUp, Users, DollarSign, 
  Star, Tag, ArrowUpRight, ArrowDownRight, Clock, CheckCircle,
  XCircle, AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell 
} from 'recharts';

interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  todayRevenue: number;
  totalReviews: number;
  pendingReviews: number;
  activeCoupons: number;
  totalCategories: number;
}

interface RecentOrder {
  id: string;
  customer_name: string | null;
  customer_email: string;
  total: number;
  status: string;
  created_at: string;
}

const Dashboard = () => {
  const { profile, roles } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [salesData, setSalesData] = useState<{ name: string; vendas: number; receita: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);

      // Fetch all data in parallel
      const [
        productsRes,
        ordersRes,
        reviewsRes,
        couponsRes,
        categoriesRes
      ] = await Promise.all([
        supabase.from('products').select('id, is_active'),
        supabase.from('orders').select('id, status, total, customer_name, customer_email, created_at'),
        supabase.from('product_reviews').select('id, is_approved'),
        supabase.from('coupons').select('id, is_active'),
        supabase.from('categories').select('id, is_active'),
      ]);

      const products = productsRes.data || [];
      const orders = ordersRes.data || [];
      const reviews = reviewsRes.data || [];
      const coupons = couponsRes.data || [];
      const categories = categoriesRes.data || [];

      // Calculate stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayOrders = orders.filter(o => new Date(o.created_at) >= today);
      const completedOrders = orders.filter(o => o.status === 'completed' || o.status === 'delivered');
      const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'processing');
      const cancelledOrders = orders.filter(o => o.status === 'cancelled');

      setStats({
        totalProducts: products.length,
        activeProducts: products.filter(p => p.is_active).length,
        totalOrders: orders.length,
        pendingOrders: pendingOrders.length,
        completedOrders: completedOrders.length,
        cancelledOrders: cancelledOrders.length,
        totalRevenue: completedOrders.reduce((sum, o) => sum + Number(o.total), 0),
        todayRevenue: todayOrders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.total), 0),
        totalReviews: reviews.length,
        pendingReviews: reviews.filter(r => !r.is_approved).length,
        activeCoupons: coupons.filter(c => c.is_active).length,
        totalCategories: categories.filter(c => c.is_active).length,
      });

      // Recent orders
      setRecentOrders(
        orders
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5)
      );

      // Sales data for chart (last 7 days)
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const dayOrders = orders.filter(o => {
          const orderDate = new Date(o.created_at);
          return orderDate >= date && orderDate < nextDate && o.status !== 'cancelled';
        });

        last7Days.push({
          name: date.toLocaleDateString('pt-BR', { weekday: 'short' }),
          vendas: dayOrders.length,
          receita: dayOrders.reduce((sum, o) => sum + Number(o.total), 0),
        });
      }
      setSalesData(last7Days);

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle }> = {
      pending: { label: 'Pendente', variant: 'outline', icon: Clock },
      processing: { label: 'Processando', variant: 'secondary', icon: AlertCircle },
      completed: { label: 'Concluído', variant: 'default', icon: CheckCircle },
      delivered: { label: 'Entregue', variant: 'default', icon: CheckCircle },
      cancelled: { label: 'Cancelado', variant: 'destructive', icon: XCircle },
    };
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const orderStatusData = stats ? [
    { name: 'Pendentes', value: stats.pendingOrders, color: 'hsl(var(--warning))' },
    { name: 'Concluídos', value: stats.completedOrders, color: 'hsl(var(--success))' },
    { name: 'Cancelados', value: stats.cancelledOrders, color: 'hsl(var(--destructive))' },
  ].filter(d => d.value > 0) : [];

  return (
    <AdminLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Olá, {profile?.full_name?.split(' ')[0] || 'Admin'}! 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            Aqui está um resumo do seu painel administrativo.
          </p>
        </div>

        {/* Main Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="card-elevated">
                <CardContent className="p-6">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-20 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <Card className="card-elevated">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Receita Total</p>
                      <p className="text-2xl font-bold mt-1">{formatCurrency(stats?.totalRevenue || 0)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Hoje: {formatCurrency(stats?.todayRevenue || 0)}
                      </p>
                    </div>
                    <div className="bg-success/10 p-3 rounded-xl">
                      <DollarSign className="h-6 w-6 text-success" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-elevated">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Pedidos</p>
                      <p className="text-2xl font-bold mt-1">{stats?.totalOrders || 0}</p>
                      <p className="text-xs text-warning mt-1">
                        {stats?.pendingOrders || 0} pendentes
                      </p>
                    </div>
                    <div className="bg-primary/10 p-3 rounded-xl">
                      <ShoppingCart className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-elevated">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Produtos</p>
                      <p className="text-2xl font-bold mt-1">{stats?.activeProducts || 0}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        de {stats?.totalProducts || 0} cadastrados
                      </p>
                    </div>
                    <div className="bg-accent/10 p-3 rounded-xl">
                      <Package className="h-6 w-6 text-accent-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-elevated">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Avaliações</p>
                      <p className="text-2xl font-bold mt-1">{stats?.totalReviews || 0}</p>
                      <p className="text-xs text-warning mt-1">
                        {stats?.pendingReviews || 0} aguardando aprovação
                      </p>
                    </div>
                    <div className="bg-warning/10 p-3 rounded-xl">
                      <Star className="h-6 w-6 text-warning" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Sales Chart */}
          <Card className="card-elevated lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Vendas dos Últimos 7 Dias
              </CardTitle>
              <CardDescription>
                Acompanhe o desempenho de vendas diário
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[250px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={salesData}>
                    <defs>
                      <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(value) => `R$${value}`} />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Receita']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="receita" 
                      stroke="hsl(var(--primary))" 
                      fillOpacity={1} 
                      fill="url(#colorReceita)" 
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Order Status Pie Chart */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Status dos Pedidos
              </CardTitle>
              <CardDescription>
                Distribuição por status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : orderStatusData.length > 0 ? (
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={orderStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {orderStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-3 justify-center mt-2">
                    {orderStatusData.map((entry, index) => (
                      <div key={index} className="flex items-center gap-1.5 text-xs">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-muted-foreground">{entry.name}: {entry.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                  Nenhum pedido registrado
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Orders */}
          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Pedidos Recentes
                </CardTitle>
                <CardDescription>
                  Últimos pedidos realizados
                </CardDescription>
              </div>
              <Link 
                to="/admin/orders" 
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                Ver todos <ArrowUpRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-6 w-20" />
                    </div>
                  ))}
                </div>
              ) : recentOrders.length > 0 ? (
                <div className="space-y-4">
                  {recentOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium text-sm">
                          {order.customer_name || order.customer_email.split('@')[0]}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(Number(order.total))} • {new Date(order.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      {getStatusBadge(order.status)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  Nenhum pedido encontrado
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Ações Rápidas
              </CardTitle>
              <CardDescription>
                Acesse rapidamente as principais áreas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <Link 
                  to="/admin/products" 
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Produtos</p>
                    <p className="text-xs text-muted-foreground">{stats?.activeProducts || 0} ativos</p>
                  </div>
                </Link>

                <Link 
                  to="/admin/orders" 
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="bg-warning/10 p-2 rounded-lg">
                    <ShoppingCart className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Pedidos</p>
                    <p className="text-xs text-muted-foreground">{stats?.pendingOrders || 0} pendentes</p>
                  </div>
                </Link>

                <Link 
                  to="/admin/reviews" 
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="bg-accent/10 p-2 rounded-lg">
                    <Star className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Avaliações</p>
                    <p className="text-xs text-muted-foreground">{stats?.pendingReviews || 0} pendentes</p>
                  </div>
                </Link>

                <Link 
                  to="/admin/coupons" 
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="bg-success/10 p-2 rounded-lg">
                    <Tag className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Cupons</p>
                    <p className="text-xs text-muted-foreground">{stats?.activeCoupons || 0} ativos</p>
                  </div>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Role Info */}
        {roles.length > 0 && (
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Suas Permissões
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {roles.map((role) => (
                  <span
                    key={role}
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary capitalize"
                  >
                    {role}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default Dashboard;
