import { RefreshCw, Package, Clock, Truck, CreditCard, AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import StoreLayout from '@/components/store/StoreLayout';

const ExchangesReturnsPage = () => {
  const steps = [
    {
      number: '1',
      title: 'Solicite a Troca',
      description: 'Entre em contato pelo WhatsApp ou e-mail informando o número do pedido e o motivo da troca.',
    },
    {
      number: '2',
      title: 'Receba as Instruções',
      description: 'Enviaremos um código de postagem gratuito (em casos aplicáveis) e as instruções de envio.',
    },
    {
      number: '3',
      title: 'Envie o Produto',
      description: 'Embale o produto com cuidado e leve até uma agência dos Correios com o código fornecido.',
    },
    {
      number: '4',
      title: 'Receba o Novo Produto',
      description: 'Após recebermos e conferirmos o produto, enviaremos o novo item ou processaremos o reembolso.',
    },
  ];

  const policies = [
    {
      icon: Clock,
      title: 'Prazo para Troca',
      items: [
        'Até 30 dias após o recebimento para trocas por tamanho, cor ou modelo',
        'Até 7 dias para desistência da compra (direito de arrependimento)',
        'Até 90 dias para produtos com defeito de fabricação',
      ],
    },
    {
      icon: Package,
      title: 'Condições do Produto',
      items: [
        'Produto sem uso e sem sinais de utilização',
        'Etiquetas originais preservadas',
        'Embalagem original ou similar que proteja o produto',
        'Acessórios e brindes que acompanham o produto',
      ],
    },
    {
      icon: Truck,
      title: 'Frete da Devolução',
      items: [
        'Defeito ou erro nosso: frete por nossa conta',
        'Troca por preferência: frete de devolução por conta do cliente',
        'Direito de arrependimento: frete por nossa conta',
        'Reenvio do novo produto: sempre gratuito',
      ],
    },
    {
      icon: CreditCard,
      title: 'Reembolso',
      items: [
        'Cartão de crédito: estorno em até 2 faturas',
        'PIX/Boleto: devolução em até 10 dias úteis',
        'Opção de crédito na loja para compras futuras',
        'Diferenças de valor são ajustadas na troca',
      ],
    },
  ];

  const restrictions = [
    'Produtos de uso íntimo (lingeries, biquínis sem o plástico protetor)',
    'Produtos personalizados ou sob medida',
    'Produtos em promoção identificados como "venda final"',
    'Produtos com sinais de uso, lavagem ou alteração',
    'Produtos sem etiqueta original',
  ];

  return (
    <StoreLayout>
      <div className="min-h-screen">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-store-secondary to-store-secondary/50 py-16 md:py-20">
          <div className="container mx-auto px-4 text-center">
            <div className="w-16 h-16 bg-store-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <RefreshCw className="h-8 w-8 text-store-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-store-accent mb-4">
              Trocas e Devoluções
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Sua satisfação é nossa prioridade. Conheça nossa política de trocas e devoluções simples e transparente.
            </p>
          </div>
        </section>

        {/* How it Works */}
        <section className="py-12 md:py-16 border-b">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-store-accent text-center mb-10">
              Como Funciona?
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {steps.map((step, index) => (
                <div key={index} className="relative">
                  <div className="bg-card border rounded-2xl p-6 h-full">
                    <div className="w-10 h-10 bg-store-primary text-store-accent rounded-full flex items-center justify-center font-bold text-lg mb-4">
                      {step.number}
                    </div>
                    <h3 className="font-semibold text-store-accent mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-0.5 bg-store-primary/30" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Policies */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-store-accent text-center mb-10">
              Políticas de Troca
            </h2>
            <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {policies.map((policy, index) => (
                <div key={index} className="bg-card border rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-store-primary/10 rounded-lg flex items-center justify-center">
                      <policy.icon className="h-5 w-5 text-store-primary" />
                    </div>
                    <h3 className="font-semibold text-store-accent">{policy.title}</h3>
                  </div>
                  <ul className="space-y-2">
                    {policy.items.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Restrictions */}
        <section className="py-12 md:py-16 bg-store-secondary/30">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center gap-3 justify-center mb-8">
                <AlertCircle className="h-6 w-6 text-amber-500" />
                <h2 className="text-2xl font-bold text-store-accent">
                  Produtos Não Elegíveis
                </h2>
              </div>
              <div className="bg-card border rounded-2xl p-6 md:p-8">
                <p className="text-muted-foreground mb-4">
                  Alguns produtos possuem restrições para troca ou devolução:
                </p>
                <ul className="space-y-3">
                  {restrictions.map((restriction, index) => (
                    <li key={index} className="flex items-start gap-3 text-sm">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full shrink-0 mt-2" />
                      <span className="text-muted-foreground">{restriction}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Quick */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold text-store-accent text-center mb-8">
                Dúvidas Frequentes
              </h2>
              <div className="space-y-4">
                <div className="bg-card border rounded-xl p-5">
                  <h3 className="font-semibold text-store-accent mb-2">
                    Posso trocar por um produto de valor diferente?
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Sim! Se o novo produto tiver valor menor, geramos um crédito para sua próxima compra. 
                    Se for mais caro, você paga apenas a diferença.
                  </p>
                </div>
                <div className="bg-card border rounded-xl p-5">
                  <h3 className="font-semibold text-store-accent mb-2">
                    O produto chegou com defeito, o que faço?
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Entre em contato imediatamente conosco com fotos do defeito. Providenciaremos a coleta 
                    gratuita e enviaremos um novo produto ou realizaremos o reembolso integral.
                  </p>
                </div>
                <div className="bg-card border rounded-xl p-5">
                  <h3 className="font-semibold text-store-accent mb-2">
                    Quanto tempo demora para receber o produto trocado?
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Após recebermos o produto devolvido (geralmente 3-7 dias úteis), fazemos a conferência 
                    em até 2 dias úteis e enviamos o novo produto com o prazo normal de entrega.
                  </p>
                </div>
              </div>
              <div className="text-center mt-6">
                <Button asChild variant="outline" className="border-store-primary text-store-primary hover:bg-store-primary hover:text-store-accent">
                  <Link to="/faq">Ver todas as perguntas frequentes</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-12 md:py-16 bg-store-accent">
          <div className="container mx-auto px-4 text-center">
            <div className="max-w-2xl mx-auto">
              <HelpCircle className="h-12 w-12 text-store-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-background mb-3">
                Precisa de Ajuda?
              </h2>
              <p className="text-background/80 mb-6">
                Nossa equipe está pronta para ajudar você com sua troca ou devolução.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild className="bg-store-primary hover:bg-store-primary/90 text-store-accent">
                  <a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer">
                    WhatsApp
                  </a>
                </Button>
                <Button asChild variant="outline" className="border-background text-background hover:bg-background hover:text-store-accent">
                  <Link to="/contato">Formulário de Contato</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </StoreLayout>
  );
};

export default ExchangesReturnsPage;
