import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Key,
  Plus,
  Copy,
  RotateCcw,
  Ban,
  Trash2,
  Eye,
  Clock,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Shield,
  Globe,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { apiKeysService, ApiKey, AVAILABLE_SCOPES } from '@/services/apiKeys';
import ApiKeySecretModal from '@/components/ApiKeySecretModal';
import ApiKeyLogsModal from '@/components/ApiKeyLogsModal';

const ApiKeys = () => {
  const { isManager } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [secretModalOpen, setSecretModalOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [newKeyData, setNewKeyData] = useState({
    publicKey: '',
    secretKey: '',
    name: '',
  });

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [allowedIps, setAllowedIps] = useState('');
  const [rateLimit, setRateLimit] = useState('60');

  const loadApiKeys = async () => {
    try {
      const keys = await apiKeysService.getAll();
      setApiKeys(keys);
    } catch (error) {
      console.error('Error loading API keys:', error);
      toast.error('Erro ao carregar API keys');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadApiKeys();
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    if (selectedScopes.length === 0) {
      toast.error('Selecione pelo menos um escopo');
      return;
    }

    setIsCreating(true);
    try {
      const { apiKey, secretKey } = await apiKeysService.create({
        name: name.trim(),
        description: description.trim() || undefined,
        scopes: selectedScopes,
        allowed_ips: allowedIps.split('\n').map(ip => ip.trim()).filter(Boolean),
        rate_limit_per_minute: parseInt(rateLimit) || 60,
      });

      setNewKeyData({
        publicKey: apiKey.public_key,
        secretKey,
        name: apiKey.name,
      });

      setCreateDialogOpen(false);
      setSecretModalOpen(true);
      loadApiKeys();

      // Reset form
      setName('');
      setDescription('');
      setSelectedScopes([]);
      setAllowedIps('');
      setRateLimit('60');
    } catch (error) {
      console.error('Error creating API key:', error);
      toast.error('Erro ao criar API key');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await apiKeysService.revoke(id);
      toast.success('API key revogada com sucesso');
      loadApiKeys();
    } catch (error) {
      toast.error('Erro ao revogar API key');
    }
  };

  const handleRotate = async (id: string, keyName: string) => {
    try {
      const { publicKey, secretKey } = await apiKeysService.rotate(id);
      setNewKeyData({
        publicKey,
        secretKey,
        name: keyName,
      });
      setSecretModalOpen(true);
      loadApiKeys();
      toast.success('Chaves rotacionadas com sucesso');
    } catch (error) {
      toast.error('Erro ao rotacionar chaves');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiKeysService.delete(id);
      toast.success('API key excluída com sucesso');
      loadApiKeys();
    } catch (error) {
      toast.error('Erro ao excluir API key');
    }
  };

  const handleViewLogs = (id: string) => {
    setSelectedKeyId(id);
    setLogsModalOpen(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência');
  };

  const getStatusBadge = (status: ApiKey['status']) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-success/10 text-success hover:bg-success/20">Ativa</Badge>;
      case 'revoked':
        return <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/20">Revogada</Badge>;
      case 'expired':
        return <Badge className="bg-warning/10 text-warning hover:bg-warning/20">Expirada</Badge>;
    }
  };

  if (!isManager) {
    return (
      <AdminLayout>
        <Card className="card-elevated">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Shield className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="text-lg mb-2">Acesso restrito</CardTitle>
            <CardDescription className="text-center">
              Apenas administradores e gerentes podem acessar esta página
            </CardDescription>
          </CardContent>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">API Keys</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie as chaves de integração para seu site externo
            </p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nova Chave
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Criar Nova API Key</DialogTitle>
                <DialogDescription>
                  A chave secreta será exibida apenas uma vez. Guarde em local seguro.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da integração *</Label>
                  <Input
                    id="name"
                    placeholder="ex: Site principal, App mobile"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    placeholder="Descreva o uso desta chave..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Escopos/Permissões *</Label>
                  <div className="grid gap-2 mt-2">
                    {AVAILABLE_SCOPES.map((scope) => (
                      <div key={scope.value} className="flex items-start gap-3 p-3 rounded-lg border">
                        <Checkbox
                          id={scope.value}
                          checked={selectedScopes.includes(scope.value)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedScopes([...selectedScopes, scope.value]);
                            } else {
                              setSelectedScopes(selectedScopes.filter(s => s !== scope.value));
                            }
                          }}
                        />
                        <div className="flex-1">
                          <label htmlFor={scope.value} className="font-medium cursor-pointer">
                            {scope.label}
                          </label>
                          <p className="text-xs text-muted-foreground">{scope.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rateLimit">Rate limit (req/min)</Label>
                  <Input
                    id="rateLimit"
                    type="number"
                    min="1"
                    max="1000"
                    value={rateLimit}
                    onChange={(e) => setRateLimit(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="allowedIps">IPs permitidos (opcional)</Label>
                  <Textarea
                    id="allowedIps"
                    placeholder="Um IP por linha&#10;ex: 192.168.1.1"
                    value={allowedIps}
                    onChange={(e) => setAllowedIps(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Deixe vazio para permitir qualquer IP
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreate} disabled={isCreating}>
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    'Criar Chave'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Info card */}
        <Card className="card-elevated border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-4 p-4">
            <div className="gradient-primary p-2 rounded-lg">
              <Key className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-semibold">Autenticação HMAC</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Suas requisições devem incluir os headers: <code className="bg-muted px-1 rounded">X-Client-Key</code>,{' '}
                <code className="bg-muted px-1 rounded">X-Timestamp</code>,{' '}
                <code className="bg-muted px-1 rounded">X-Nonce</code> e{' '}
                <code className="bg-muted px-1 rounded">X-Signature</code> (HMAC-SHA256)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* API Keys Table */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle>Chaves ativas</CardTitle>
            <CardDescription>
              Lista de todas as API keys configuradas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Key className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhuma API key criada ainda</p>
                <Button className="mt-4 gap-2" onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Criar primeira chave
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Chave Pública</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Escopos</TableHead>
                      <TableHead>Último uso</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys.map((key) => (
                      <TableRow key={key.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{key.name}</p>
                            {key.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {key.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                              {key.public_key.slice(0, 16)}...
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(key.public_key)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(key.status)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[150px]">
                            {key.scopes.slice(0, 2).map((scope) => (
                              <Badge key={scope} variant="secondary" className="text-xs">
                                {scope}
                              </Badge>
                            ))}
                            {key.scopes.length > 2 && (
                              <Badge variant="secondary" className="text-xs">
                                +{key.scopes.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {key.last_used_at ? (
                            <div className="text-sm">
                              <p>{format(new Date(key.last_used_at), 'dd/MM/yy HH:mm', { locale: ptBR })}</p>
                              {key.last_used_ip && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Globe className="h-3 w-3" />
                                  {key.last_used_ip}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Nunca usada</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleViewLogs(key.id)}
                              title="Ver logs"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>

                            {key.status === 'active' && (
                              <>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      title="Rotacionar chaves"
                                    >
                                      <RotateCcw className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Rotacionar chaves?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Isso irá gerar novas chaves pública e secreta. A chave atual será invalidada imediatamente.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleRotate(key.id, key.name)}>
                                        Rotacionar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>

                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-warning hover:text-warning"
                                      title="Revogar"
                                    >
                                      <Ban className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Revogar API key?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        A chave será desativada imediatamente e não poderá mais ser usada para autenticar requisições.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleRevoke(key.id)}
                                        className="bg-warning text-warning-foreground hover:bg-warning/90"
                                      >
                                        Revogar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  title="Excluir"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir API key?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação não pode ser desfeita. Todos os logs associados também serão removidos.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(key.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ApiKeySecretModal
        open={secretModalOpen}
        onClose={() => setSecretModalOpen(false)}
        publicKey={newKeyData.publicKey}
        secretKey={newKeyData.secretKey}
        name={newKeyData.name}
      />

      <ApiKeyLogsModal
        open={logsModalOpen}
        onClose={() => setLogsModalOpen(false)}
        apiKeyId={selectedKeyId}
      />
    </AdminLayout>
  );
};

export default ApiKeys;
