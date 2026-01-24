import { HelpCircle, Truck, RefreshCw, CreditCard, Shield, Clock, Package } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import StoreLayout from '@/components/store/StoreLayout';

const FaqPage = () => {
  const faqCategories = [
    {
      id: 'entrega',
      icon: Truck,
      title: 'Entrega e Frete',
      questions: [
        {
          question: 'Qual o prazo de entrega?',
          answer: 'O prazo de entrega varia de acordo com a região. Para capitais, o prazo é de 3 a 7 dias úteis. Para demais regiões, pode variar de 7 a 15 dias úteis. Após o envio, você receberá um código de rastreamento para acompanhar seu pedido.',
        },
        {
          question: 'Como funciona o frete grátis?',
          answer: 'Oferecemos frete grátis para compras acima de R$199,00 para todo o Brasil. Para compras abaixo desse valor, o frete é calculado com base no CEP de entrega no momento do checkout.',
        },
        {
          question: 'Posso rastrear meu pedido?',
          answer: 'Sim! Após a postagem do seu pedido, enviaremos um e-mail com o código de rastreamento. Você também pode acompanhar o status do pedido na área "Meus Pedidos" em sua conta.',
        },
        {
          question: 'Vocês entregam em todo o Brasil?',
          answer: 'Sim, entregamos em todo o território nacional através dos Correios e transportadoras parceiras. O prazo e valor do frete são calculados automaticamente com base no seu CEP.',
        },
        {
          question: 'E se eu não estiver em casa no momento da entrega?',
          answer: 'Os Correios e transportadoras fazem até 3 tentativas de entrega. Caso não seja possível entregar, o pacote ficará disponível para retirada na agência mais próxima por um período determinado.',
        },
      ],
    },
    {
      id: 'trocas',
      icon: RefreshCw,
      title: 'Trocas e Devoluções',
      questions: [
        {
          question: 'Como faço para trocar um produto?',
          answer: 'Você tem até 30 dias após o recebimento para solicitar a troca. Basta entrar em contato conosco pelo WhatsApp ou e-mail informando o número do pedido e o motivo da troca. Enviaremos as instruções para devolução e, após recebermos o produto, enviaremos o novo item.',
        },
        {
          question: 'Qual a política de devolução?',
          answer: 'Aceitamos devoluções em até 7 dias após o recebimento para produtos com defeito ou diferentes do anunciado (direito de arrependimento). O produto deve estar sem uso, com etiquetas e na embalagem original. O reembolso é feito em até 10 dias úteis após recebermos o produto.',
        },
        {
          question: 'Quem paga o frete da troca/devolução?',
          answer: 'Em caso de defeito ou erro nosso, a Lagoona arca com o frete de devolução. Para trocas por outros motivos (tamanho, cor, etc.), o frete de devolução é por conta do cliente, mas oferecemos frete grátis no reenvio.',
        },
        {
          question: 'Posso trocar por um produto de valor diferente?',
          answer: 'Sim! Se o novo produto tiver valor menor, geramos um crédito para sua próxima compra. Se for mais caro, você paga apenas a diferença.',
        },
        {
          question: 'Como sei qual tamanho escolher?',
          answer: 'Cada produto possui uma tabela de medidas na página do produto. Recomendamos medir uma peça similar que você já tenha e comparar com nossas medidas. Em caso de dúvidas, entre em contato conosco que ajudamos você!',
        },
      ],
    },
    {
      id: 'pagamentos',
      icon: CreditCard,
      title: 'Pagamentos',
      questions: [
        {
          question: 'Quais formas de pagamento são aceitas?',
          answer: 'Aceitamos cartões de crédito (Visa, Mastercard, Elo, American Express), cartão de débito, PIX e boleto bancário. No cartão de crédito, você pode parcelar em até 12x sem juros.',
        },
        {
          question: 'É seguro comprar no site?',
          answer: 'Sim! Nossa loja possui certificado SSL, que criptografa todos os seus dados. Não armazenamos dados de cartão de crédito - todas as transações são processadas por gateways de pagamento seguros e certificados.',
        },
        {
          question: 'Posso parcelar minhas compras?',
          answer: 'Sim! Oferecemos parcelamento em até 12x sem juros no cartão de crédito para compras acima de R$100,00. O valor mínimo de cada parcela é R$20,00.',
        },
        {
          question: 'Como funciona o pagamento via PIX?',
          answer: 'Ao escolher PIX, você receberá um QR Code e um código "copia e cola". O pagamento é confirmado instantaneamente e seu pedido é processado imediatamente. O código tem validade de 30 minutos.',
        },
        {
          question: 'Quando meu cartão será cobrado?',
          answer: 'A cobrança no cartão é realizada no momento da confirmação do pedido. Em caso de cancelamento antes do envio, o estorno é feito automaticamente e aparece na sua fatura em até 2 faturas.',
        },
      ],
    },
    {
      id: 'produtos',
      icon: Package,
      title: 'Produtos',
      questions: [
        {
          question: 'Os produtos têm garantia?',
          answer: 'Sim! Todos os produtos possuem garantia de 90 dias contra defeitos de fabricação. Caso identifique algum problema, entre em contato conosco para avaliarmos e resolvermos da melhor forma.',
        },
        {
          question: 'As cores dos produtos são fiéis às fotos?',
          answer: 'Fazemos o máximo para que as fotos representem fielmente as cores dos produtos. Porém, pequenas variações podem ocorrer devido às configurações de tela de cada dispositivo.',
        },
        {
          question: 'Como cuidar das peças?',
          answer: 'Cada produto possui instruções de lavagem na etiqueta. De modo geral, recomendamos lavar à mão ou em ciclo delicado, com água fria, e secar à sombra para preservar as cores e o tecido.',
        },
        {
          question: 'Vocês repõem produtos esgotados?',
          answer: 'Sim! Trabalhamos constantemente para repor os produtos mais procurados. Você pode se cadastrar para receber um aviso quando o produto voltar ao estoque.',
        },
      ],
    },
    {
      id: 'conta',
      icon: Shield,
      title: 'Conta e Privacidade',
      questions: [
        {
          question: 'Preciso criar uma conta para comprar?',
          answer: 'Não é obrigatório, mas recomendamos! Com uma conta, você pode acompanhar seus pedidos, salvar endereços, criar lista de desejos e ter acesso a promoções exclusivas.',
        },
        {
          question: 'Como altero meus dados cadastrais?',
          answer: 'Acesse sua conta, vá em "Meus Dados" e edite as informações desejadas. Para alterações de e-mail, pode ser necessária uma verificação de segurança.',
        },
        {
          question: 'Vocês compartilham meus dados?',
          answer: 'Não! Seus dados são tratados com total sigilo e usados apenas para processar seus pedidos e melhorar sua experiência. Confira nossa Política de Privacidade para mais detalhes.',
        },
      ],
    },
  ];

  return (
    <StoreLayout>
      <div className="min-h-screen">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-store-secondary to-store-secondary/50 py-16 md:py-20">
          <div className="container mx-auto px-4 text-center">
            <div className="w-16 h-16 bg-store-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <HelpCircle className="h-8 w-8 text-store-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-store-accent mb-4">
              Perguntas Frequentes
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Encontre respostas rápidas para as dúvidas mais comuns sobre nossa loja.
            </p>
          </div>
        </section>

        {/* Quick Navigation */}
        <section className="border-b bg-card sticky top-0 z-10">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-2 py-4 overflow-x-auto">
              {faqCategories.map((category) => (
                <a
                  key={category.id}
                  href={`#${category.id}`}
                  className="flex items-center gap-2 px-4 py-2 bg-store-secondary/50 hover:bg-store-secondary rounded-lg text-sm font-medium text-store-accent whitespace-nowrap transition-colors"
                >
                  <category.icon className="h-4 w-4 text-store-primary" />
                  {category.title}
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Content */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="space-y-10">
              {faqCategories.map((category) => (
                <div key={category.id} id={category.id} className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-store-primary/10 rounded-lg flex items-center justify-center">
                      <category.icon className="h-5 w-5 text-store-primary" />
                    </div>
                    <h2 className="text-2xl font-bold text-store-accent">
                      {category.title}
                    </h2>
                  </div>

                  <Accordion type="single" collapsible className="space-y-3">
                    {category.questions.map((faq, index) => (
                      <AccordionItem
                        key={index}
                        value={`${category.id}-${index}`}
                        className="bg-card border rounded-xl px-6 data-[state=open]:shadow-sm"
                      >
                        <AccordionTrigger className="text-left font-medium text-store-accent hover:text-store-primary hover:no-underline py-5">
                          {faq.question}
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
                          {faq.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact CTA */}
        <section className="py-12 md:py-16 bg-store-secondary/30">
          <div className="container mx-auto px-4 text-center">
            <div className="max-w-2xl mx-auto">
              <Clock className="h-12 w-12 text-store-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-store-accent mb-3">
                Não encontrou sua resposta?
              </h2>
              <p className="text-muted-foreground mb-6">
                Nossa equipe está pronta para ajudar você. Entre em contato e responderemos o mais rápido possível.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild className="bg-store-primary hover:bg-store-primary/90 text-store-accent">
                  <Link to="/contato">Falar com Atendimento</Link>
                </Button>
                <Button asChild variant="outline" className="border-store-primary text-store-primary hover:bg-store-primary hover:text-store-accent">
                  <a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer">
                    WhatsApp
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </StoreLayout>
  );
};

export default FaqPage;
