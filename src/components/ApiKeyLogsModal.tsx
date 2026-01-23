import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Activity, CheckCircle, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { apiKeysService, ApiKeyLog } from '@/services/apiKeys';

interface ApiKeyLogsModalProps {
  open: boolean;
  onClose: () => void;
  apiKeyId: string | null;
}

const ApiKeyLogsModal = ({ open, onClose, apiKeyId }: ApiKeyLogsModalProps) => {
  const [logs, setLogs] = useState<ApiKeyLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (open && apiKeyId) {
      loadLogs();
    }
  }, [open, apiKeyId]);

  const loadLogs = async () => {
    if (!apiKeyId) return;
    
    setIsLoading(true);
    try {
      const data = await apiKeysService.getLogs(apiKeyId);
      setLogs(data);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) {
      return (
        <Badge className="bg-success/10 text-success hover:bg-success/20 gap-1">
          <CheckCircle className="h-3 w-3" />
          {statusCode}
        </Badge>
      );
    }
    if (statusCode >= 400) {
      return (
        <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/20 gap-1">
          <XCircle className="h-3 w-3" />
          {statusCode}
        </Badge>
      );
    }
    return <Badge variant="secondary">{statusCode}</Badge>;
  };

  const getMethodBadge = (method: string) => {
    const colors: Record<string, string> = {
      GET: 'bg-primary/10 text-primary',
      POST: 'bg-success/10 text-success',
      PUT: 'bg-warning/10 text-warning',
      DELETE: 'bg-destructive/10 text-destructive',
      PATCH: 'bg-accent/10 text-accent',
    };
    return (
      <Badge className={`${colors[method] || 'bg-muted text-muted-foreground'} font-mono`}>
        {method}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Logs de Uso
          </DialogTitle>
          <DialogDescription>
            Últimas 50 requisições feitas com esta API key
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Clock className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum log encontrado</p>
              <p className="text-sm text-muted-foreground">
                Os logs aparecerão quando a API key for usada
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tempo</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {format(new Date(log.created_at), 'dd/MM/yy HH:mm:ss', { locale: ptBR })}
                    </TableCell>
                    <TableCell>{getMethodBadge(log.method)}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {log.endpoint}
                      </code>
                    </TableCell>
                    <TableCell>{getStatusBadge(log.status_code)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.response_time_ms ? `${log.response_time_ms}ms` : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      {log.ip_address || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ApiKeyLogsModal;
