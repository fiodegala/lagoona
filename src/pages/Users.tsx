import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Plus, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navigate } from 'react-router-dom';

const UsersPage = () => {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
            <p className="text-muted-foreground mt-1">Gerencie os usuários e suas permissões</p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Convidar Usuário
          </Button>
        </div>

        <Card className="card-elevated">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="text-lg mb-2">Gerenciamento de usuários</CardTitle>
            <CardDescription className="text-center mb-4">
              Adicione usuários e atribua roles (admin, manager, support)
            </CardDescription>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              Apenas administradores podem acessar esta página
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default UsersPage;
