import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, ShoppingCart, Key, TrendingUp, Users, DollarSign } from 'lucide-react';

const Dashboard = () => {
  const { profile, roles } = useAuth();

  const stats = [
    {
      title: 'Total Produtos',
      value: '124',
      change: '+12%',
      icon: Package,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Pedidos Hoje',
      value: '32',
      change: '+8%',
      icon: ShoppingCart,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
    {
      title: 'Receita Mensal',
      value: 'R$ 45.231',
      change: '+23%',
      icon: DollarSign,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'API Keys Ativas',
      value: '3',
      change: '0',
      icon: Key,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
  ];

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

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="card-elevated">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    <p className="text-xs text-success mt-1">{stat.change} vs. mês passado</p>
                  </div>
                  <div className={`${stat.bgColor} p-3 rounded-xl`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                API Keys
              </CardTitle>
              <CardDescription>
                Gerencie as chaves de integração para seu site
              </CardDescription>
            </CardHeader>
            <CardContent>
              <a
                href="/settings/api-keys"
                className="inline-flex items-center text-sm font-medium text-primary hover:underline"
              >
                Gerenciar chaves →
              </a>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-accent" />
                Produtos
              </CardTitle>
              <CardDescription>
                Adicione e gerencie seus produtos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <a
                href="/products"
                className="inline-flex items-center text-sm font-medium text-primary hover:underline"
              >
                Ver produtos →
              </a>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-success" />
                Relatórios
              </CardTitle>
              <CardDescription>
                Acompanhe o desempenho do seu negócio
              </CardDescription>
            </CardHeader>
            <CardContent>
              <a
                href="/reports"
                className="inline-flex items-center text-sm font-medium text-primary hover:underline"
              >
                Ver relatórios →
              </a>
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
