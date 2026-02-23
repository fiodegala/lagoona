import { Shield, Eye, Lock, Database, UserCheck, Mail, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import StoreLayout from '@/components/store/StoreLayout';

const PrivacyPolicyPage = () => {
  const lastUpdated = '24 de Janeiro de 2026';

  const sections = [
    {
      icon: Eye,
      title: '1. Informações que Coletamos',
      content: [
        {
          subtitle: '1.1 Dados fornecidos por você',
          text: 'Coletamos informações que você nos fornece diretamente, como: nome completo, endereço de e-mail, número de telefone, endereço de entrega, CPF (para emissão de nota fiscal), dados de pagamento e histórico de compras.',
        },
        {
          subtitle: '1.2 Dados coletados automaticamente',
          text: 'Quando você acessa nosso site, coletamos automaticamente: endereço IP, tipo de navegador, páginas visitadas, tempo de permanência, dados de cookies e identificadores de dispositivo.',
        },
        {
          subtitle: '1.3 Dados de terceiros',
          text: 'Podemos receber informações de parceiros de marketing, redes sociais (quando você faz login social) e serviços de análise de dados.',
        },
      ],
    },
    {
      icon: Database,
      title: '2. Como Usamos suas Informações',
      content: [
        {
          subtitle: '2.1 Processamento de pedidos',
          text: 'Utilizamos seus dados para processar compras, calcular frete, emitir notas fiscais, enviar produtos e comunicar sobre o status do pedido.',
        },
        {
          subtitle: '2.2 Comunicação',
          text: 'Podemos enviar e-mails sobre promoções, novidades e conteúdos relevantes. Você pode cancelar o recebimento a qualquer momento.',
        },
        {
          subtitle: '2.3 Melhoria dos serviços',
          text: 'Analisamos dados para entender preferências, personalizar experiência, desenvolver novos recursos e melhorar nosso atendimento.',
        },
        {
          subtitle: '2.4 Segurança e prevenção a fraudes',
          text: 'Utilizamos dados para detectar atividades suspeitas, prevenir fraudes e garantir a segurança das transações.',
        },
      ],
    },
    {
      icon: Lock,
      title: '3. Compartilhamento de Dados',
      content: [
        {
          subtitle: '3.1 Parceiros de serviço',
          text: 'Compartilhamos dados com empresas que nos auxiliam nas operações: processadores de pagamento, transportadoras, serviços de e-mail marketing e plataformas de análise.',
        },
        {
          subtitle: '3.2 Obrigações legais',
          text: 'Podemos divulgar informações quando exigido por lei, ordem judicial ou para proteger nossos direitos legais.',
        },
        {
          subtitle: '3.3 Não vendemos seus dados',
          text: 'A Fio de Gala não vende, aluga ou comercializa suas informações pessoais para terceiros.',
        },
      ],
    },
    {
      icon: Shield,
      title: '4. Segurança dos Dados',
      content: [
        {
          subtitle: '4.1 Medidas de proteção',
          text: 'Implementamos criptografia SSL, firewalls, controle de acesso restrito e monitoramento contínuo para proteger suas informações.',
        },
        {
          subtitle: '4.2 Armazenamento seguro',
          text: 'Seus dados são armazenados em servidores seguros com backup regular. Dados de pagamento são processados por gateways certificados PCI-DSS.',
        },
        {
          subtitle: '4.3 Retenção de dados',
          text: 'Mantemos seus dados pelo tempo necessário para cumprir as finalidades descritas ou conforme exigido por lei (geralmente 5 anos para dados fiscais).',
        },
      ],
    },
    {
      icon: UserCheck,
      title: '5. Seus Direitos',
      content: [
        {
          subtitle: '5.1 Acesso e correção',
          text: 'Você pode acessar, corrigir ou atualizar seus dados pessoais a qualquer momento através da sua conta ou entrando em contato conosco.',
        },
        {
          subtitle: '5.2 Exclusão de dados',
          text: 'Você pode solicitar a exclusão dos seus dados pessoais, exceto quando precisarmos mantê-los para obrigações legais ou fiscais.',
        },
        {
          subtitle: '5.3 Portabilidade',
          text: 'Você tem direito de receber uma cópia dos seus dados em formato estruturado e de uso comum.',
        },
        {
          subtitle: '5.4 Revogação de consentimento',
          text: 'Você pode revogar consentimentos dados anteriormente, como para recebimento de e-mails marketing.',
        },
      ],
    },
    {
      icon: Clock,
      title: '6. Cookies e Tecnologias',
      content: [
        {
          subtitle: '6.1 O que são cookies',
          text: 'Cookies são pequenos arquivos armazenados no seu dispositivo que nos ajudam a melhorar sua experiência de navegação.',
        },
        {
          subtitle: '6.2 Tipos de cookies utilizados',
          text: 'Utilizamos cookies essenciais (funcionamento do site), de desempenho (análise de uso), funcionais (preferências) e de marketing (publicidade personalizada).',
        },
        {
          subtitle: '6.3 Gerenciamento de cookies',
          text: 'Você pode configurar seu navegador para recusar cookies, mas isso pode afetar algumas funcionalidades do site.',
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
              <Shield className="h-8 w-8 text-store-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-store-accent mb-4">
              Política de Privacidade
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
                A <strong className="text-store-accent">Fio de Gala</strong> valoriza a privacidade dos seus clientes e visitantes. 
                Esta Política de Privacidade explica como coletamos, usamos, armazenamos e protegemos suas informações pessoais 
                quando você utiliza nosso site e serviços. Ao utilizar nossos serviços, você concorda com as práticas descritas 
                nesta política.
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

            {/* Contact */}
            <div className="bg-store-secondary/30 rounded-2xl p-6 md:p-8 mt-8">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-store-primary/10 rounded-lg flex items-center justify-center shrink-0">
                  <Mail className="h-5 w-5 text-store-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-store-accent mb-2">
                    Dúvidas sobre Privacidade?
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Se você tiver qualquer dúvida sobre esta política ou sobre como tratamos seus dados, 
                    entre em contato com nosso Encarregado de Proteção de Dados (DPO).
                  </p>
                  <p className="text-sm">
                    <strong className="text-store-accent">E-mail:</strong>{' '}
                    <a href="mailto:privacidade@fiodegala.com.br" className="text-store-primary hover:underline">
                      privacidade@fiodegala.com.br
                    </a>
                  </p>
                </div>
              </div>
            </div>

            {/* Related Links */}
            <div className="flex flex-wrap gap-4 mt-8 justify-center">
              <Link
                to="/termos"
                className="text-sm text-store-primary hover:underline"
              >
                Termos de Uso →
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

export default PrivacyPolicyPage;
