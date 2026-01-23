import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Products = () => {
  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Produtos</h1>
            <p className="text-muted-foreground mt-1">Gerencie seu catálogo de produtos</p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Produto
          </Button>
        </div>

        <Card className="card-elevated">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="text-lg mb-2">Nenhum produto cadastrado</CardTitle>
            <CardDescription className="text-center mb-4">
              Comece adicionando seu primeiro produto
            </CardDescription>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Produto
            </Button>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default Products;
