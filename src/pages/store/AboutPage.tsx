import { Heart, Award, Truck, ShieldCheck, Users, Leaf } from 'lucide-react';
import StoreLayout from '@/components/store/StoreLayout';

const AboutPage = () => {
  const values = [
    {
      icon: Heart,
      title: 'Paixão pela Moda',
      description: 'Cada peça é selecionada com carinho e atenção aos detalhes para você.',
    },
    {
      icon: Award,
      title: 'Qualidade Premium',
      description: 'Trabalhamos apenas com materiais de alta qualidade e durabilidade.',
    },
    {
      icon: Truck,
      title: 'Entrega Rápida',
      description: 'Enviamos para todo o Brasil com agilidade e segurança.',
    },
    {
      icon: ShieldCheck,
      title: 'Compra Segura',
      description: 'Seus dados protegidos e garantia de satisfação em todas as compras.',
    },
    {
      icon: Users,
      title: 'Atendimento Humanizado',
      description: 'Nossa equipe está sempre pronta para ajudar você.',
    },
    {
      icon: Leaf,
      title: 'Sustentabilidade',
      description: 'Compromisso com práticas responsáveis e conscientes.',
    },
  ];

  return (
    <StoreLayout>
      <div className="min-h-screen">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-store-secondary to-store-secondary/50 py-16 md:py-24">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-store-accent mb-6">
              Sobre a Lagoona
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
              Nascemos com o propósito de levar moda de qualidade e estilo único para você. 
              Nossa missão é fazer você se sentir incrível em cada momento.
            </p>
          </div>
        </section>

        {/* Story Section */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold text-store-accent mb-6">
                  Nossa História
                </h2>
                <div className="space-y-4 text-muted-foreground">
                  <p>
                    A Lagoona nasceu em 2024 do sonho de criar uma marca que unisse 
                    qualidade, estilo e acessibilidade. Começamos pequenos, mas com uma 
                    grande visão: transformar a forma como as pessoas se vestem e se sentem.
                  </p>
                  <p>
                    Hoje, somos uma equipe apaixonada por moda, dedicada a selecionar 
                    as melhores peças e tendências para nossos clientes. Cada produto 
                    em nossa loja passa por uma curadoria cuidadosa.
                  </p>
                  <p>
                    Acreditamos que a moda é uma forma de expressão e queremos que você 
                    encontre aqui as peças perfeitas para contar sua história.
                  </p>
                </div>
              </div>
              <div className="bg-store-secondary rounded-2xl p-8 md:p-12">
                <div className="grid grid-cols-2 gap-6 text-center">
                  <div>
                    <p className="text-4xl font-bold text-store-primary">10k+</p>
                    <p className="text-sm text-muted-foreground mt-1">Clientes Satisfeitos</p>
                  </div>
                  <div>
                    <p className="text-4xl font-bold text-store-primary">500+</p>
                    <p className="text-sm text-muted-foreground mt-1">Produtos</p>
                  </div>
                  <div>
                    <p className="text-4xl font-bold text-store-primary">50+</p>
                    <p className="text-sm text-muted-foreground mt-1">Cidades Atendidas</p>
                  </div>
                  <div>
                    <p className="text-4xl font-bold text-store-primary">4.9</p>
                    <p className="text-sm text-muted-foreground mt-1">Avaliação Média</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="py-16 md:py-20 bg-store-secondary/30">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-store-accent text-center mb-12">
              Nossos Valores
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {values.map((value, index) => (
                <div
                  key={index}
                  className="bg-background rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="w-12 h-12 bg-store-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <value.icon className="h-6 w-6 text-store-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-store-accent mb-2">
                    {value.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {value.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold text-store-accent mb-4">
              Pronta para conhecer nossa coleção?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Explore nossos produtos e encontre as peças perfeitas para você.
            </p>
            <a
              href="/loja"
              className="inline-flex items-center justify-center px-8 py-3 bg-store-primary text-store-accent font-semibold rounded-lg hover:bg-store-primary/90 transition-colors"
            >
              Ver Produtos
            </a>
          </div>
        </section>
      </div>
    </StoreLayout>
  );
};

export default AboutPage;
