import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, AlertTriangle, CheckCircle, Key } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

interface ApiKeySecretModalProps {
  open: boolean;
  onClose: () => void;
  publicKey: string;
  secretKey: string;
  name: string;
}

const ApiKeySecretModal = ({ open, onClose, publicKey, secretKey, name }: ApiKeySecretModalProps) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiada!`);
    setCopied(true);
  };

  const copyAll = () => {
    const envContent = `# API Keys para: ${name}
API_BASE_URL=https://krlnrzwshjwupiklzblz.supabase.co/functions/v1
PUBLIC_API_KEY=${publicKey}
SECRET_API_KEY=${secretKey}`;
    navigator.clipboard.writeText(envContent);
    toast.success('Todas as variáveis copiadas!');
    setCopied(true);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="gradient-primary p-1.5 rounded-lg">
              <Key className="h-4 w-4 text-primary-foreground" />
            </div>
            Chave Criada com Sucesso!
          </DialogTitle>
          <DialogDescription>
            Guarde a chave secreta em local seguro. Ela não será exibida novamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-warning">Atenção!</p>
              <p className="text-foreground/80">
                A <strong>SECRET_API_KEY</strong> só é exibida uma vez. Copie e guarde em local seguro antes de fechar.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Chave Pública (PUBLIC_API_KEY)
              </Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={publicKey}
                  className="font-mono text-sm bg-muted"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(publicKey, 'Chave pública')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-destructive uppercase tracking-wide">
                Chave Secreta (SECRET_API_KEY) ⚠️
              </Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={secretKey}
                  className="font-mono text-sm bg-destructive/5 border-destructive/30"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(secretKey, 'Chave secreta')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Variáveis de ambiente</p>
            <pre className="bg-muted p-3 rounded-lg text-xs font-mono overflow-x-auto">
{`# Adicione ao seu .env ou configuração do host
API_BASE_URL=https://krlnrzwshjwupiklzblz.supabase.co/functions/v1
PUBLIC_API_KEY=${publicKey}
SECRET_API_KEY=${secretKey}`}
            </pre>
            <Button variant="outline" className="w-full mt-2" onClick={copyAll}>
              <Copy className="h-4 w-4 mr-2" />
              Copiar tudo
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="w-full sm:w-auto">
            {copied ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Pronto, copiei!
              </>
            ) : (
              'Fechar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ApiKeySecretModal;
