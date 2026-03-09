import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Instagram, CreditCard } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import logoLagoona from '@/assets/logo-lagoona.png';

const StoreFooter = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-store-dark text-white mt-auto">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="inline-block">
              <img src={logoLagoona} alt="Fio de Gala" className="h-10" />
            </Link>
            <p className="text-sm text-white/50">
              Moda masculina premium para o homem contemporâneo. Qualidade, elegância e estilo em cada peça.
            </p>
            <div className="flex flex-col gap-2 text-sm text-white/50">
              <span className="flex items-start gap-2">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                Av. Bernardo Sayão, nº 1202, Setor Centro Oeste - Goiânia - GO, CEP 74550-200
              </span>
              <a href="tel:+5562994165785" className="flex items-center gap-2 hover:text-store-gold transition-colors">
                <Phone className="h-4 w-4" />
                (62) 99416-5785
              </a>
              <a href="mailto:fiodegalafdg@gmail.com" className="flex items-center gap-2 hover:text-store-gold transition-colors">
                <Mail className="h-4 w-4" />
                fiodegalafdg@gmail.com
              </a>
            </div>
            <div className="flex gap-3 pt-2">
              <a href="https://www.instagram.com/fiodegalafdg/" target="_blank" rel="noopener noreferrer" className="p-2.5 border border-white/15 rounded-full hover:bg-store-gold hover:border-store-gold hover:text-store-dark transition-colors">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="#" className="p-2.5 border border-white/15 rounded-full hover:bg-store-gold hover:border-store-gold hover:text-store-dark transition-colors">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.75a8.18 8.18 0 0 0 4.76 1.52V6.84a4.84 4.84 0 0 1-1-.15z"/></svg>
              </a>
              <a href="#" className="p-2.5 border border-white/15 rounded-full hover:bg-store-gold hover:border-store-gold hover:text-store-dark transition-colors">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              </a>
            </div>
          </div>

          {/* Institucional */}
          <div className="space-y-4">
            <h4 className="font-display font-semibold text-store-gold text-sm tracking-[0.15em] uppercase">Institucional</h4>
            <nav className="flex flex-col gap-2 text-sm">
              <Link to="/sobre" className="text-white/50 hover:text-store-gold transition-colors">Sobre a FDG</Link>
              <Link to="/contato" className="text-white/50 hover:text-store-gold transition-colors">Contato</Link>
              <Link to="/atacado" className="text-white/50 hover:text-store-gold transition-colors">Atacado</Link>
              <Link to="/trabalhe-conosco" className="text-white/50 hover:text-store-gold transition-colors">Trabalhe Conosco</Link>
              <Link to="/afiliados" className="text-white/50 hover:text-store-gold transition-colors">Programa de Afiliados</Link>
            </nav>
          </div>

          {/* Ajuda */}
          <div className="space-y-4">
            <h4 className="font-display font-semibold text-store-gold text-sm tracking-[0.15em] uppercase">Ajuda</h4>
            <nav className="flex flex-col gap-2 text-sm">
              <Link to="/trocas-devolucoes" className="text-white/50 hover:text-store-gold transition-colors">Trocas e Devoluções</Link>
              <Link to="/privacidade" className="text-white/50 hover:text-store-gold transition-colors">Política de Privacidade</Link>
              <Link to="/termos" className="text-white/50 hover:text-store-gold transition-colors">Termos de Uso</Link>
              <Link to="/faq" className="text-white/50 hover:text-store-gold transition-colors">FAQ</Link>
            </nav>
          </div>

          {/* Categorias */}
          <div className="space-y-4">
            <h4 className="font-display font-semibold text-store-gold text-sm tracking-[0.15em] uppercase">Categorias</h4>
            <nav className="flex flex-col gap-2 text-sm">
              <Link to="/loja/categoria/camisetas" className="text-white/50 hover:text-store-gold transition-colors">Camisetas</Link>
              <Link to="/loja/categoria/camisas" className="text-white/50 hover:text-store-gold transition-colors">Camisas</Link>
              <Link to="/loja/categoria/calcas" className="text-white/50 hover:text-store-gold transition-colors">Calças</Link>
              <Link to="/loja/categoria/blazers" className="text-white/50 hover:text-store-gold transition-colors">Blazers</Link>
            </nav>
          </div>
        </div>

        <Separator className="my-8 bg-white/10" />

        {/* Payment + Copyright */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-white/30">
              <CreditCard className="h-4 w-4" />
              <span className="text-xs">Cartão de Crédito, PIX, Boleto</span>
            </div>
            <div className="flex items-center gap-2">
              {['Visa', 'Mastercard', 'Elo', 'PIX'].map((method) => (
                <span key={method} className="px-3 py-1 bg-white/5 text-xs font-medium border border-white/10 rounded">
                  {method}
                </span>
              ))}
            </div>
          </div>
          <p className="text-xs text-white/30 text-center">
            © {currentYear} Fio de Gala. Todos os direitos reservados. CNPJ: 07.950.021/0001-17
          </p>
        </div>
      </div>
    </footer>
  );
};

export default StoreFooter;
