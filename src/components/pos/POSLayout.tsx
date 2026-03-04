import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Wifi,
  WifiOff,
  Clock,
  RefreshCw,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { offlineService } from '@/services/offlineService';
import { POSSession } from '@/services/posService';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface POSLayoutProps {
  children: React.ReactNode;
  session: POSSession | null;
  onOpenCashDrawer?: () => void;
}

const POSLayout = ({ children, session, onOpenCashDrawer }: POSLayoutProps) => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const unsubscribe = offlineService.onOnlineStatusChange(setIsOnline);
    
    // Update pending count
    const updatePending = async () => {
      const count = await offlineService.getPendingSalesCount();
      setPendingCount(count);
    };
    updatePending();
    const interval = setInterval(updatePending, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSync = async () => {
    if (!isOnline || isSyncing) return;
    
    setIsSyncing(true);
    try {
      await offlineService.syncPendingSales();
      const count = await offlineService.getPendingSalesCount();
      setPendingCount(count);
    } finally {
      setIsSyncing(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-y-auto">
      {/* Header */}
      <header className="h-12 sm:h-14 border-b bg-card flex items-center justify-between px-2 sm:px-4 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 sm:h-9 sm:w-9"
            onClick={() => navigate('/admin')}
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-semibold">PDV</h1>
            {session && (
              <Badge variant="secondary" className="font-normal text-xs hidden sm:inline-flex">
                Caixa #{session.id.slice(0, 8)}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Pending sales indicator */}
          {pendingCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={!isOnline || isSyncing}
              className="gap-1 sm:gap-2 h-8 text-xs sm:text-sm"
            >
              <RefreshCw className={cn('h-3 w-3 sm:h-4 sm:w-4', isSyncing && 'animate-spin')} />
              <span className="hidden sm:inline">{pendingCount} pendente{pendingCount > 1 ? 's' : ''}</span>
              <span className="sm:hidden">{pendingCount}</span>
            </Button>
          )}

          {/* Online/Offline indicator */}
          <div className={cn(
            'flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm',
            isOnline 
              ? 'bg-green-500/10 text-green-600' 
              : 'bg-destructive/10 text-destructive'
          )}>
            {isOnline ? (
              <Wifi className="h-3 w-3 sm:h-4 sm:w-4" />
            ) : (
              <WifiOff className="h-3 w-3 sm:h-4 sm:w-4" />
            )}
            <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {/* Time display - hidden on very small screens */}
          <div className="hidden md:flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <div className="text-right">
              <div className="text-sm font-medium text-foreground">
                {formatTime(currentTime)}
              </div>
              <div className="text-xs">
                {formatDate(currentTime)}
              </div>
            </div>
          </div>

          {/* Menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9">
                <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Menu do PDV</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-2">
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  Operador: {profile?.full_name || 'Usuário'}
                </div>
                
                {/* Show time on mobile in menu */}
                <div className="px-3 py-2 text-sm md:hidden">
                  <span className="text-muted-foreground">Hora: </span>
                  {formatTime(currentTime)} — {formatDate(currentTime)}
                </div>

                {session && (
                  <>
                    <div className="px-3 py-2 text-sm">
                      <span className="text-muted-foreground">Caixa: </span>
                      #{session.id.slice(0, 8)}
                    </div>
                    <div className="px-3 py-2 text-sm">
                      <span className="text-muted-foreground">Abertura: </span>
                      {new Date(session.opened_at).toLocaleString('pt-BR')}
                    </div>
                    <div className="px-3 py-2 text-sm">
                      <span className="text-muted-foreground">Saldo inicial: </span>
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(session.opening_balance)}
                    </div>
                  </>
                )}

                <div className="border-t my-4" />

                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => navigate('/admin/pos/sessions')}
                >
                  Histórico de Sessões
                </Button>
                
                {onOpenCashDrawer && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={onOpenCashDrawer}
                  >
                    Gestão do Caixa
                  </Button>
                )}

                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => navigate('/admin')}
                >
                  Voltar ao Admin
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-destructive text-destructive-foreground px-3 sm:px-4 py-1.5 sm:py-2 text-center text-xs sm:text-sm">
          <WifiOff className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1 sm:mr-2" />
          <span className="hidden sm:inline">Você está offline. As vendas serão sincronizadas quando a conexão for restaurada.</span>
          <span className="sm:hidden">Modo offline — vendas serão sincronizadas depois.</span>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 min-h-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
};

export default POSLayout;
