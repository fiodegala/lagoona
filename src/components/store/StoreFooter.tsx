import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, CreditCard, Truck, Shield, Headphones, Facebook, Instagram, Twitter, MessageCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const StoreFooter = () => {
  const currentYear = new Date().getFullYear();

  const paymentMethods = ['Visa', 'Mastercard', 'Elo', 'Pix', 'Boleto'];

  return (
    <footer className="bg-store-secondary/50 border-t mt-auto">
      {/* Features bar */}
      <div className="border-b bg-background">
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-store-primary/10">
                <Truck className="h-6 w-6 text-store-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">Frete Grátis</h4>
                <p className="text-xs text-muted-foreground">Acima de R$199</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-store-primary/10">
                <Shield className="h-6 w-6 text-store-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">Compra Segura</h4>
                <p className="text-xs text-muted-foreground">Dados protegidos</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-store-primary/10">
                <CreditCard className="h-6 w-6 text-store-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">Parcele em 12x</h4>
                <p className="text-xs text-muted-foreground">Sem juros</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-store-primary/10">
                <Headphones className="h-6 w-6 text-store-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">Suporte 24h</h4>
                <p className="text-xs text-muted-foreground">Estamos aqui</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main footer */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-store-primary flex items-center justify-center">
                <span className="text-store-accent font-display font-bold text-xl">L</span>
              </div>
              <span className="font-display font-bold text-2xl text-store-accent">Lagoona</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Sua loja online com os melhores produtos, preços imbatíveis e entrega para todo Brasil.
            </p>
            <div className="flex gap-3">
              <a href="#" className="p-2 rounded-full bg-store-accent/10 hover:bg-store-primary hover:text-store-accent transition-colors">
                <Facebook className="h-4 w-4" />
              </a>
              <a href="#" className="p-2 rounded-full bg-store-accent/10 hover:bg-store-primary hover:text-store-accent transition-colors">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="#" className="p-2 rounded-full bg-store-accent/10 hover:bg-store-primary hover:text-store-accent transition-colors">
                <Twitter className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Institutional */}
          <div className="space-y-4">
            <h4 className="font-display font-semibold text-store-accent">Institucional</h4>
            <nav className="flex flex-col gap-2 text-sm">
              <Link to="/sobre" className="text-muted-foreground hover:text-store-primary transition-colors">
                Sobre Nós
              </Link>
              <Link to="/contato" className="text-muted-foreground hover:text-store-primary transition-colors">
                Fale Conosco
              </Link>
              <Link to="/trabalhe-conosco" className="text-muted-foreground hover:text-store-primary transition-colors">
                Trabalhe Conosco
              </Link>
              <Link to="/lojas" className="text-muted-foreground hover:text-store-primary transition-colors">
                Nossas Lojas
              </Link>
            </nav>
          </div>

          {/* Help */}
          <div className="space-y-4">
            <h4 className="font-display font-semibold text-store-accent">Ajuda</h4>
            <nav className="flex flex-col gap-2 text-sm">
              <Link to="/como-comprar" className="text-muted-foreground hover:text-store-primary transition-colors">
                Como Comprar
              </Link>
              <Link to="/formas-pagamento" className="text-muted-foreground hover:text-store-primary transition-colors">
                Formas de Pagamento
              </Link>
              <Link to="/trocas-devolucoes" className="text-muted-foreground hover:text-store-primary transition-colors">
                Trocas e Devoluções
              </Link>
              <Link to="/politica-privacidade" className="text-muted-foreground hover:text-store-primary transition-colors">
                Política de Privacidade
              </Link>
            </nav>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="font-display font-semibold text-store-accent">Contato</h4>
            <div className="flex flex-col gap-3 text-sm">
              <a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-store-primary transition-colors">
                <MessageCircle className="h-4 w-4" />
                (11) 99999-9999
              </a>
              <a href="mailto:contato@lagoona.com.br" className="flex items-center gap-2 text-muted-foreground hover:text-store-primary transition-colors">
                <Mail className="h-4 w-4" />
                contato@lagoona.com.br
              </a>
              <a href="tel:+551133334444" className="flex items-center gap-2 text-muted-foreground hover:text-store-primary transition-colors">
                <Phone className="h-4 w-4" />
                (11) 3333-4444
              </a>
              <span className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                Av. Exemplo, 1234 - São Paulo, SP
              </span>
            </div>
          </div>
        </div>

        <Separator className="my-8" />

        {/* Payment & Bottom */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="text-xs text-muted-foreground mr-2">Formas de pagamento:</span>
            {paymentMethods.map((method) => (
              <span key={method} className="px-2 py-1 bg-background rounded text-xs font-medium border">
                {method}
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            © {currentYear} Lagoona. Todos os direitos reservados. CNPJ: 00.000.000/0001-00
          </p>
        </div>
      </div>
    </footer>
  );
};

export default StoreFooter;
