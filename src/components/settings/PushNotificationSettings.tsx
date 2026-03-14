import { useState } from 'react';
import { Bell, BellRing, Loader2, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Badge } from '@/components/ui/badge';

export default function PushNotificationSettings() {
  const { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) {
    return (
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Notificações Push
          </CardTitle>
          <CardDescription>
            Seu navegador não suporta notificações push. Para iOS, adicione o site à Tela Inicial como PWA.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Notificações Push
          {isSubscribed && <Badge variant="secondary" className="text-xs">Ativo</Badge>}
        </CardTitle>
        <CardDescription>
          Receba notificações em tempo real no seu celular — novos pedidos, vendas PDV, carrinhos abandonados e alertas de estoque.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {permission === 'denied' && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            As notificações foram bloqueadas no navegador. Vá nas configurações do navegador/app para permitir.
          </div>
        )}

        <div className="flex items-center gap-3">
          {isSubscribed ? (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BellRing className="h-4 w-4 text-green-500" />
                Notificações push estão ativas neste dispositivo
              </div>
              <Button variant="outline" size="sm" onClick={unsubscribe} disabled={isLoading}>
                Desativar
              </Button>
            </>
          ) : (
            <Button onClick={subscribe} disabled={isLoading || permission === 'denied'}>
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Ativando...</>
              ) : (
                <><Bell className="mr-2 h-4 w-4" /> Ativar notificações push</>
              )}
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          📱 No iOS, certifique-se de ter adicionado o site à Tela Inicial para receber notificações.
        </p>
      </CardContent>
    </Card>
  );
}
