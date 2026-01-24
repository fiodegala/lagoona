import { Link } from 'react-router-dom';
import { Store, Mail, Phone, MapPin } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const StoreFooter = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-muted/50 border-t mt-auto">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2 font-bold text-xl">
              <Store className="h-6 w-6 text-primary" />
              Minha Loja
            </Link>
            <p className="text-sm text-muted-foreground">
              Sua loja online com os melhores produtos e preços.
            </p>
          </div>

          {/* Links */}
          <div className="space-y-4">
            <h4 className="font-semibold">Links Úteis</h4>
            <nav className="flex flex-col gap-2 text-sm">
              <Link to="/loja" className="text-muted-foreground hover:text-foreground transition-colors">
                Produtos
              </Link>
              <Link to="/sobre" className="text-muted-foreground hover:text-foreground transition-colors">
                Sobre Nós
              </Link>
              <Link to="/contato" className="text-muted-foreground hover:text-foreground transition-colors">
                Contato
              </Link>
            </nav>
          </div>

          {/* Policies */}
          <div className="space-y-4">
            <h4 className="font-semibold">Políticas</h4>
            <nav className="flex flex-col gap-2 text-sm">
              <Link to="/politica-privacidade" className="text-muted-foreground hover:text-foreground transition-colors">
                Política de Privacidade
              </Link>
              <Link to="/termos-uso" className="text-muted-foreground hover:text-foreground transition-colors">
                Termos de Uso
              </Link>
              <Link to="/trocas-devolucoes" className="text-muted-foreground hover:text-foreground transition-colors">
                Trocas e Devoluções
              </Link>
            </nav>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="font-semibold">Contato</h4>
            <div className="flex flex-col gap-3 text-sm">
              <a href="mailto:contato@minhaloja.com" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                <Mail className="h-4 w-4" />
                contato@minhaloja.com
              </a>
              <a href="tel:+5511999999999" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                <Phone className="h-4 w-4" />
                (11) 99999-9999
              </a>
              <span className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                São Paulo, SP
              </span>
            </div>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© {currentYear} Minha Loja. Todos os direitos reservados.</p>
          <p>Desenvolvido com ❤️</p>
        </div>
      </div>
    </footer>
  );
};

export default StoreFooter;
