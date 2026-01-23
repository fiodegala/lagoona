import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

const Reports = () => {
  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground mt-1">Análise de desempenho e métricas</p>
        </div>

        <Card className="card-elevated">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="text-lg mb-2">Relatórios em breve</CardTitle>
            <CardDescription className="text-center">
              Os relatórios serão disponibilizados quando houver dados suficientes
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default Reports;
