import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Instagram, Link2, Unlink, Eye, EyeOff, Copy, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';

interface IntegrationInfo {
  id: string;
  instagram_user_id: string | null;
  instagram_username: string | null;
  token_type: string;
  expires_at: string | null;
  scopes: string[];
  status: string;
  connected_at: string;
  masked_token: string;
  full_token?: string;
}

const InstagramIntegrationSettings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [integration, setIntegration] = useState<IntegrationInfo | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [fullToken, setFullToken] = useState<string | null>(null);

  useEffect(() => {
    // Handle callback results
    const igResult = searchParams.get('instagram');
    if (igResult === 'success') {
      toast.success('Instagram conectado com sucesso!');
      searchParams.delete('instagram');
      setSearchParams(searchParams, { replace: true });
    } else if (igResult === 'error') {
      const reason = searchParams.get('reason') || 'unknown';
      toast.error(`Erro ao conectar Instagram: ${reason}`);
      searchParams.delete('instagram');
      searchParams.delete('reason');
      setSearchParams(searchParams, { replace: true });
    }
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('instagram-status', {
        method: 'POST',
        body: {},
      });

      if (error) throw error;

      setConnected(data.connected);
      setIntegration(data.integration || null);
    } catch (err) {
      console.error('Error fetching Instagram status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('instagram-auth');
      if (error) throw error;

      if (!data?.authUrl) {
        throw new Error('OAuth URL não recebida');
      }

      const oauthUrl = new URL(data.authUrl);
      const allowedHosts = ['www.facebook.com', 'facebook.com', 'm.facebook.com'];

      if (!allowedHosts.includes(oauthUrl.hostname)) {
        throw new Error('URL de redirecionamento inválida');
      }

      if (window.top && window.top !== window.self) {
        window.open(data.authUrl, '_top');
        return;
      }

      window.location.assign(data.authUrl);
    } catch (err) {
      console.error('Error starting Instagram auth:', err);
      toast.error('Erro ao iniciar conexão com Instagram');
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Tem certeza que deseja desconectar o Instagram?')) return;

    setIsDisconnecting(true);
    try {
      const { error } = await supabase.functions.invoke('instagram-disconnect', {
        method: 'POST',
      });
      if (error) throw error;

      toast.success('Instagram desconectado');
      setConnected(false);
      setIntegration(null);
      setFullToken(null);
      setShowToken(false);
    } catch (err) {
      console.error('Error disconnecting Instagram:', err);
      toast.error('Erro ao desconectar Instagram');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleShowToken = async () => {
    if (showToken) {
      setShowToken(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('instagram-status', {
        method: 'POST',
        body: { showFullToken: true },
      });
      if (error) throw error;
      setFullToken(data.integration?.full_token || null);
      setShowToken(true);
    } catch {
      toast.error('Erro ao carregar token');
    }
  };

  const handleCopyToken = () => {
    if (fullToken) {
      navigator.clipboard.writeText(fullToken);
      toast.success('Token copiado!');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
            <Instagram className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-lg">Integração Instagram</CardTitle>
            <CardDescription>Conecte sua conta Instagram Business via OAuth</CardDescription>
          </div>
          <div className="ml-auto">
            {connected ? (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Conectado
              </Badge>
            ) : (
              <Badge variant="secondary">
                <AlertTriangle className="h-3 w-3 mr-1" /> Desconectado
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {connected && integration ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {integration.instagram_username && (
                <div>
                  <span className="text-muted-foreground">Usuário:</span>{' '}
                  <span className="font-medium">@{integration.instagram_username}</span>
                </div>
              )}
              {integration.instagram_user_id && (
                <div>
                  <span className="text-muted-foreground">ID:</span>{' '}
                  <span className="font-mono text-xs">{integration.instagram_user_id}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Tipo de Token:</span>{' '}
                <Badge variant="outline" className="text-xs">{integration.token_type}</Badge>
              </div>
              {integration.expires_at && (
                <div>
                  <span className="text-muted-foreground">Expira em:</span>{' '}
                  <span>{new Date(integration.expires_at).toLocaleDateString('pt-BR')}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Conectado em:</span>{' '}
                <span>{new Date(integration.connected_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground">Token:</span>
              <code className="text-xs font-mono flex-1">
                {showToken && fullToken ? fullToken : integration.masked_token}
              </code>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleShowToken}>
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              {showToken && fullToken && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopyToken}>
                  <Copy className="h-4 w-4" />
                </Button>
              )}
            </div>

            {integration.scopes && integration.scopes.length > 0 && (
              <div>
                <span className="text-sm text-muted-foreground">Permissões:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {integration.scopes.map((scope) => (
                    <Badge key={scope} variant="outline" className="text-xs">{scope}</Badge>
                  ))}
                </div>
              </div>
            )}

            <Button
              variant="destructive"
              size="sm"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Unlink className="h-4 w-4 mr-2" />}
              Desconectar Instagram
            </Button>
          </>
        ) : (
          <div className="text-center py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Conecte sua conta Instagram Business para gerenciar publicações e acessar métricas.
            </p>
            <Button onClick={handleConnect} disabled={isConnecting}>
              {isConnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
              Conectar Instagram
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InstagramIntegrationSettings;
