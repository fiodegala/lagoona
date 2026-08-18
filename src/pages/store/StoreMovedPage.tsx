import { ArrowRight, MapPin, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const StoreMovedPage = () => {
  const handleRedirect = () => {
    window.location.href = 'https://fiodegala.com/';
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[hsl(var(--store-dark))] px-4 py-8 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[hsl(var(--store-primary))] opacity-10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-[hsl(var(--store-primary))] opacity-10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-2xl w-full text-center">
        <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--store-primary))]/10 border border-[hsl(var(--store-primary))]/30 text-[hsl(var(--store-primary))] text-sm font-medium">
          <Sparkles className="h-4 w-4" />
          <span>Novo endereço, mesma essência</span>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
          Mudamos de endereço
        </h1>

        <p className="text-base sm:text-lg text-[hsl(var(--store-secondary))]/80 mb-8 max-w-xl mx-auto">
          A Fio de Gala está agora em um endereço novo, ainda mais rápido e bonito para atender você. Clique no botão abaixo e continue sua experiência.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
          <Button
            onClick={handleRedirect}
            size="lg"
            className="w-full sm:w-auto min-h-[56px] px-8 text-base font-semibold bg-[hsl(var(--store-primary))] text-[hsl(var(--store-dark))] hover:bg-[hsl(var(--store-primary))]/90 rounded-full shadow-lg shadow-[hsl(var(--store-primary))]/20 transition-all hover:scale-105"
          >
            Acessar nova loja
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>

        <a
          href="https://fiodegala.com/"
          className="inline-flex items-center gap-2 text-[hsl(var(--store-primary))] hover:text-[hsl(var(--store-primary))]/80 transition-colors text-sm sm:text-base"
        >
          <MapPin className="h-4 w-4" />
          https://fiodegala.com/
        </a>

        <p className="mt-12 text-xs text-white/40">
          Redirecionamento automático em alguns segundos...
        </p>
      </div>

      {/* Auto-redirect after 5 seconds */}
      <script
        dangerouslySetInnerHTML={{
          __html: `setTimeout(() => { window.location.href = 'https://fiodegala.com/'; }, 5000);`,
        }}
      />
    </div>
  );
};

export default StoreMovedPage;
