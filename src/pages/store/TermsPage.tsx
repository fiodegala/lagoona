import { FileText, ShoppingBag, CreditCard, Truck, RefreshCw, Scale, AlertTriangle, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import StoreLayout from '@/components/store/StoreLayout';

const TermsPage = () => {
  const lastUpdated = '24 de Janeiro de 2026';

  const sections = [
    {
      icon: FileText,
      title: '1. Disposições Gerais',
      content: [
        {
          subtitle: '1.1 Aceitação dos termos',
          text: 'Ao acessar e utilizar o site da Lagoona, você declara ter lido, compreendido e concordado com estes Termos de Uso. Caso não concorde, solicitamos que não utilize nossos serviços.',
        },
        {
          subtitle: '1.2 Modificações',
          text: 'Reservamo-nos o direito de modificar estes termos a qualquer momento. As alterações entram em vigor imediatamente após a publicação. Recomendamos a revisão periódica desta página.',
        },
        {
          subtitle: '1.3 Elegibilidade',
          text: 'Para realizar compras em nosso site, você deve ter no mínimo 18 anos ou estar devidamente representado por responsável legal.',
        },
      ],
    },
    {
      icon: ShoppingBag,
      title: '2. Produtos e Pedidos',
      content: [
        {
          subtitle: '2.1 Descrição dos produtos',
          text: 'Nos esforçamos para descrever com precisão nossos produtos, incluindo cores, tamanhos e materiais. Pequenas variações podem ocorrer e não caracterizam defeito.',
        },
        {
          subtitle: '2.2 Disponibilidade',
          text: 'Todos os produtos estão sujeitos à disponibilidade de estoque. Reservamo-nos o direito de limitar quantidades ou recusar pedidos a nosso critério.',
        },
        {
          subtitle: '2.3 Confirmação do pedido',
          text: 'A confirmação do pedido será enviada por e-mail após a aprovação do pagamento. O contrato de compra se estabelece somente após esta confirmação.',
        },
        {
          subtitle: '2.4 Cancelamento pela loja',
          text: 'Podemos cancelar pedidos em casos de indisponibilidade de produto, suspeita de fraude ou erros de precificação. Nesses casos, o valor pago será integralmente reembolsado.',
        },
      ],
    },
    {
      icon: CreditCard,
      title: '3. Preços e Pagamentos',
      content: [
        {
          subtitle: '3.1 Preços',
          text: 'Todos os preços são exibidos em Reais (R$) e podem ser alterados sem aviso prévio. O preço válido é aquele exibido no momento da finalização da compra.',
        },
        {
          subtitle: '3.2 Formas de pagamento',
          text: 'Aceitamos cartões de crédito, débito, PIX e boleto bancário. O parcelamento está sujeito a análise de crédito e condições específicas.',
        },
        {
          subtitle: '3.3 Segurança nas transações',
          text: 'Utilizamos criptografia SSL e gateways de pagamento certificados. Não armazenamos dados completos de cartão de crédito em nossos servidores.',
        },
        {
          subtitle: '3.4 Cupons e promoções',
          text: 'Cupons de desconto possuem regras específicas de uso, validade e não são cumulativos, salvo indicação expressa.',
        },
      ],
    },
    {
      icon: Truck,
      title: '4. Entrega',
      content: [
        {
          subtitle: '4.1 Prazo de entrega',
          text: 'Os prazos informados são estimativas e começam a contar após a confirmação do pagamento. Podem variar conforme a região e condições externas.',
        },
        {
          subtitle: '4.2 Endereço de entrega',
          text: 'O cliente é responsável por fornecer endereço correto e completo. Problemas decorrentes de informações incorretas são de responsabilidade do comprador.',
        },
        {
          subtitle: '4.3 Recebimento',
          text: 'No ato do recebimento, verifique a integridade da embalagem. Em caso de avarias visíveis, recuse o recebimento ou registre a ocorrência junto ao entregador.',
        },
        {
          subtitle: '4.4 Tentativas de entrega',
          text: 'São realizadas até 3 tentativas de entrega. Após isso, o produto retorna ao nosso centro de distribuição, podendo gerar custos adicionais.',
        },
      ],
    },
    {
      icon: RefreshCw,
      title: '5. Trocas e Devoluções',
      content: [
        {
          subtitle: '5.1 Direito de arrependimento',
          text: 'Conforme o Código de Defesa do Consumidor, você pode desistir da compra em até 7 dias corridos após o recebimento, sem necessidade de justificativa.',
        },
        {
          subtitle: '5.2 Condições para troca/devolução',
          text: 'O produto deve estar sem uso, com etiquetas e na embalagem original. Produtos de uso íntimo, personalizados ou em promoção final podem ter restrições.',
        },
        {
          subtitle: '5.3 Produtos com defeito',
          text: 'Em caso de defeito de fabricação, você tem até 90 dias para solicitar troca ou reparo. Defeitos causados por mau uso não são cobertos pela garantia.',
        },
        {
          subtitle: '5.4 Reembolso',
          text: 'O reembolso é processado na mesma forma de pagamento original, em até 10 dias úteis após o recebimento do produto devolvido.',
        },
      ],
    },
    {
      icon: Scale,
      title: '6. Propriedade Intelectual',
      content: [
        {
          subtitle: '6.1 Direitos autorais',
          text: 'Todo o conteúdo do site (textos, imagens, logos, design) é de propriedade da Lagoona ou licenciado, protegido por leis de propriedade intelectual.',
        },
        {
          subtitle: '6.2 Uso permitido',
          text: 'É permitido visualizar e imprimir conteúdo para uso pessoal. É proibida a reprodução, distribuição ou modificação para fins comerciais sem autorização.',
        },
        {
          subtitle: '6.3 Marcas registradas',
          text: 'O nome "Lagoona" e logotipos associados são marcas registradas. Seu uso não autorizado constitui violação de direitos.',
        },
      ],
    },
    {
      icon: AlertTriangle,
      title: '7. Limitação de Responsabilidade',
      content: [
        {
          subtitle: '7.1 Disponibilidade do site',
          text: 'Não garantimos disponibilidade ininterrupta do site. Manutenções programadas e problemas técnicos podem causar indisponibilidade temporária.',
        },
        {
          subtitle: '7.2 Links externos',
          text: 'Nosso site pode conter links para sites de terceiros. Não nos responsabilizamos pelo conteúdo, políticas ou práticas desses sites.',
        },
        {
          subtitle: '7.3 Uso indevido',
          text: 'Não nos responsabilizamos por danos decorrentes de uso indevido do site, incluindo violação de segurança por parte do usuário.',
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
              <FileText className="h-8 w-8 text-store-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-store-accent mb-4">
              Termos de Uso
            </h1>
            <p className="text-muted-foreground">
              Última atualização: {lastUpdated}
            </p>
          </div>
        </section>

        {/* Content */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4 max-w-4xl">
            {/* Introduction */}
            <div className="bg-card border rounded-2xl p-6 md:p-8 mb-8">
              <p className="text-muted-foreground leading-relaxed">
                Bem-vindo à <strong className="text-store-accent">Lagoona</strong>! Estes Termos de Uso regulam o acesso 
                e utilização do nosso site e serviços de e-commerce. Ao navegar ou realizar compras, você concorda 
                integralmente com as condições aqui estabelecidas. Leia atentamente antes de prosseguir.
              </p>
            </div>

            {/* Sections */}
            <div className="space-y-8">
              {sections.map((section, index) => (
                <div key={index} className="bg-card border rounded-2xl p-6 md:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-store-primary/10 rounded-lg flex items-center justify-center">
                      <section.icon className="h-5 w-5 text-store-primary" />
                    </div>
                    <h2 className="text-xl font-bold text-store-accent">
                      {section.title}
                    </h2>
                  </div>
                  <div className="space-y-4">
                    {section.content.map((item, idx) => (
                      <div key={idx}>
                        <h3 className="font-semibold text-store-accent mb-2">
                          {item.subtitle}
                        </h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          {item.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Jurisdiction */}
            <div className="bg-card border rounded-2xl p-6 md:p-8 mt-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-store-primary/10 rounded-lg flex items-center justify-center">
                  <Scale className="h-5 w-5 text-store-primary" />
                </div>
                <h2 className="text-xl font-bold text-store-accent">
                  8. Foro e Legislação
                </h2>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Estes Termos de Uso são regidos pelas leis da República Federativa do Brasil. 
                Para dirimir quaisquer controvérsias, fica eleito o foro da Comarca de São Paulo/SP, 
                com renúncia expressa a qualquer outro, por mais privilegiado que seja.
              </p>
            </div>

            {/* Contact */}
            <div className="bg-store-secondary/30 rounded-2xl p-6 md:p-8 mt-8">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-store-primary/10 rounded-lg flex items-center justify-center shrink-0">
                  <Mail className="h-5 w-5 text-store-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-store-accent mb-2">
                    Dúvidas sobre os Termos?
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Se você tiver qualquer dúvida sobre estes Termos de Uso, entre em contato conosco.
                  </p>
                  <p className="text-sm">
                    <strong className="text-store-accent">E-mail:</strong>{' '}
                    <a href="mailto:contato@lagoona.com.br" className="text-store-primary hover:underline">
                      contato@lagoona.com.br
                    </a>
                  </p>
                </div>
              </div>
            </div>

            {/* Related Links */}
            <div className="flex flex-wrap gap-4 mt-8 justify-center">
              <Link
                to="/privacidade"
                className="text-sm text-store-primary hover:underline"
              >
                Política de Privacidade →
              </Link>
              <Link
                to="/faq"
                className="text-sm text-store-primary hover:underline"
              >
                Perguntas Frequentes →
              </Link>
              <Link
                to="/contato"
                className="text-sm text-store-primary hover:underline"
              >
                Fale Conosco →
              </Link>
            </div>
          </div>
        </section>
      </div>
    </StoreLayout>
  );
};

export default TermsPage;
