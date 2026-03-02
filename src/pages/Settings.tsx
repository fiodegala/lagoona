import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import SalesGoalsSettings from '@/components/settings/SalesGoalsSettings';
import WhatsAppTemplatesSettings from '@/components/settings/WhatsAppTemplatesSettings';
import DealsCountdownSettings from '@/components/settings/DealsCountdownSettings';
import FeaturedProductSettings from '@/components/settings/FeaturedProductSettings';
import VideoTestimonialsSettings from '@/components/settings/VideoTestimonialsSettings';
import RecoveryCouponSettings from '@/components/settings/RecoveryCouponSettings';

const Settings = () => {
  const { profile } = useAuth();

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground mt-1">Gerencie suas preferências e conta</p>
        </div>

        <SalesGoalsSettings />

        <DealsCountdownSettings />

        <FeaturedProductSettings />

        <VideoTestimonialsSettings />

        <RecoveryCouponSettings />

        <WhatsAppTemplatesSettings />

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Perfil
              </CardTitle>
              <CardDescription>Suas informações pessoais</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome completo</Label>
                <Input defaultValue={profile?.full_name || ''} />
              </div>
              <Button>Salvar alterações</Button>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Segurança
              </CardTitle>
              <CardDescription>Configurações de segurança da conta</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Alterar senha</Label>
                <Input type="password" placeholder="Nova senha" />
              </div>
              <Button variant="outline">Atualizar senha</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Settings;
