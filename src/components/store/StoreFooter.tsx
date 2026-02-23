import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Instagram, Facebook, MessageCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import logoLagoona from '@/assets/logo-lagoona.png';

const StoreFooter = () => {
  const currentYear = new Date().getFullYear();
  const paymentMethods = ['Visa', 'Mastercard', 'Elo', 'Pix', 'Boleto'];

  return (
    <footer className="bg-store-accent text-background mt-auto">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="inline-block">
              <img src={logoLagoona} alt="Fio de Gala" className="h-10" />
            </Link>
            <p className="text-sm text-background/60">
              Moda premium para o homem contemporâneo. Qualidade, elegância e estilo em cada peça.
            </p>
            <div className="flex flex-col gap-2 text-sm text-background/60">
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0" />
                Av. Exemplo, 1234 - São Paulo, SP - CEP 01000-000
              </span>
              <a href="tel:+551199999999" className="flex items-center gap-2 hover:text-store-primary transition-colors">
                <Phone className="h-4 w-4" />
                (11) 99999-9999
              </a>
              <a href="mailto:contato@fiodegala.com.br" className="flex items-center gap-2 hover:text-store-primary transition-colors">
                <Mail className="h-4 w-4" />
                contato@fiodegala.com.br
              </a>
            </div>
            <div className="flex gap-3 pt-2">
              <a href="#" className="p-2.5 rounded-full border border-background/20 hover:bg-store-primary hover:border-store-primary hover:text-store-primary-foreground transition-colors">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="#" className="p-2.5 rounded-full border border-background/20 hover:bg-store-primary hover:border-store-primary hover:text-store-primary-foreground transition-colors">
                <Facebook className="h-4 w-4" />
              </a>
              <a href="#" className="p-2.5 rounded-full border border-background/20 hover:bg-store-primary hover:border-store-primary hover:text-store-primary-foreground transition-colors">
                <MessageCircle className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Institucional */}
          <div className="space-y-4">
            <h4 className="font-display font-semibold text-background">Institucional</h4>
            <nav className="flex flex-col gap-2 text-sm">
              <Link to="/sobre" className="text-background/60 hover:text-store-primary transition-colors">Sobre a Fio de Gala</Link>
              <Link to="/contato" className="text-background/60 hover:text-store-primary transition-colors">Contato</Link>
              <Link to="/trabalhe-conosco" className="text-background/60 hover:text-store-primary transition-colors">Trabalhe Conosco</Link>
            </nav>
          </div>

          {/* Ajuda */}
          <div className="space-y-4">
            <h4 className="font-display font-semibold text-background">Ajuda</h4>
            <nav className="flex flex-col gap-2 text-sm">
              <Link to="/trocas-devolucoes" className="text-background/60 hover:text-store-primary transition-colors">Trocas e Devoluções</Link>
              <Link to="/privacidade" className="text-background/60 hover:text-store-primary transition-colors">Política de Privacidade</Link>
              <Link to="/termos" className="text-background/60 hover:text-store-primary transition-colors">Termos de Uso</Link>
              <Link to="/faq" className="text-background/60 hover:text-store-primary transition-colors">FAQ</Link>
            </nav>
          </div>

          {/* Categorias */}
          <div className="space-y-4">
            <h4 className="font-display font-semibold text-background">Categorias</h4>
            <nav className="flex flex-col gap-2 text-sm">
              <Link to="/loja" className="text-background/60 hover:text-store-primary transition-colors">Todos os Produtos</Link>
              <Link to="/loja?ordenar=recentes" className="text-background/60 hover:text-store-primary transition-colors">Lançamentos</Link>
              <Link to="/loja?ofertas=true" className="text-background/60 hover:text-store-primary transition-colors">Ofertas</Link>
            </nav>
          </div>
        </div>

        <Separator className="my-8 bg-background/10" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="text-xs text-background/40 mr-2">Cartão de Crédito, PIX, Boleto</span>
            {paymentMethods.map((method) => (
              <span key={method} className="px-2 py-1 bg-background/10 rounded text-xs font-medium border border-background/10">
                {method}
              </span>
            ))}
          </div>
          <p className="text-xs text-background/40 text-center">
            © {currentYear} Fio de Gala. Todos os direitos reservados. CNPJ: 00.000.000/0001-00
          </p>
        </div>
      </div>
    </footer>
  );
};

export default StoreFooter;
