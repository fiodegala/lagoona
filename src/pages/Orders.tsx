import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { ShoppingCart } from 'lucide-react';

const Orders = () => {
  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pedidos</h1>
          <p className="text-muted-foreground mt-1">Visualize e gerencie os pedidos</p>
        </div>

        <Card className="card-elevated">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="text-lg mb-2">Nenhum pedido encontrado</CardTitle>
            <CardDescription className="text-center">
              Os pedidos aparecerão aqui quando forem criados via API
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default Orders;
