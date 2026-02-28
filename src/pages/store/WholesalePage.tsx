import { useState } from 'react';
import StoreLayout from '@/components/store/StoreLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import {
  DollarSign, GraduationCap, Headphones, Truck, ShoppingCart, RefreshCw,
  CreditCard, Package, Award, MessageCircle, Send
} from 'lucide-react';
import atacadoBg from '@/assets/atacado-fdg.jpg';

const BENEFITS = [
  { icon: DollarSign, title: 'Preços Especiais para Revendedores', desc: 'Condições exclusivas e margens atrativas para maximizar seus lucros.' },
  { icon: GraduationCap, title: 'Acesso a FDG Academy', desc: 'Treinamentos e conteúdos exclusivos para impulsionar suas vendas.' },
  { icon: Headphones, title: 'Consultoria Especializada', desc: 'Suporte dedicado para ajudar no crescimento do seu negócio.' },
  { icon: Truck, title: 'Condições Especiais de Frete', desc: 'Frete com valores diferenciados para parceiros.' },
  { icon: ShoppingCart, title: 'Pedido Inteligente', desc: 'Sistema prático e rápido para fazer seus pedidos.' },
  { icon: RefreshCw, title: 'Troca de Produtos o Ano Todo', desc: 'Flexibilidade para trocar produtos durante todo o ano.' },
  { icon: CreditCard, title: 'Condições Especiais de Pagamento', desc: 'Opções flexíveis de pagamento para facilitar suas compras.' },
  { icon: Package, title: 'Estoque Garantido', desc: 'Produtos sempre disponíveis para pronta entrega.' },
  { icon: Award, title: 'Qualidade Premium', desc: 'Produtos de alta qualidade com garantia.' },
];

const FAQ_ITEMS = [
  { q: 'Qual é o pedido mínimo para atacado?', a: 'O pedido mínimo é de R$ 1.500,00. Trabalhamos com pacotes especiais para novos parceiros que estão começando.' },
  { q: 'Quais são as formas de pagamento?', a: 'Aceitamos PIX, cartão de crédito (até 6x sem juros), boleto bancário e transferência bancária. Parceiros recorrentes podem ter condições especiais.' },
  { q: 'Quanto tempo demora a entrega?', a: 'O prazo médio é de 3 a 7 dias úteis, dependendo da sua região. Parceiros da região Centro-Oeste têm prazo reduzido.' },
  { q: 'Posso revender online?', a: 'Sim! Você pode revender tanto em loja física quanto online. Oferecemos materiais de apoio para divulgação digital.' },
  { q: 'Como funciona a política de trocas?', a: 'Parceiros têm direito a troca de produtos durante todo o ano, desde que estejam em perfeitas condições e com etiquetas originais.' },
];

const STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const WholesalePage = () => {
  const [formData, setFormData] = useState({
    name: '', company: '', document: '', city: '', state: '', whatsapp: '', instagram: '', volume: '', message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.document || !formData.city || !formData.state || !formData.whatsapp) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }
    setIsSubmitting(true);
    // Build WhatsApp message
    const msg = `Olá! Quero me cadastrar como revendedor.\n\nNome: ${formData.name}\nEmpresa: ${formData.company || 'N/A'}\nCPF/CNPJ: ${formData.document}\nCidade/UF: ${formData.city}/${formData.state}\nWhatsApp: ${formData.whatsapp}\nInstagram: ${formData.instagram || 'N/A'}\nVolume estimado: ${formData.volume || 'N/A'}\nMensagem: ${formData.message || 'N/A'}`;
    window.open(`https://wa.me/5562994165785?text=${encodeURIComponent(msg)}`, '_blank');
    toast.success('Redirecionando para o WhatsApp...');
    setIsSubmitting(false);
  };

  return (
    <StoreLayout>
      {/* Hero Section */}
      <section className="relative min-h-[420px] flex items-center justify-center overflow-hidden">
        <img
          src={atacadoBg}
          alt="Atacado Fio de Gala"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-[hsl(var(--store-dark)/0.75)]" />
        <div className="relative z-10 text-center px-4 py-20 max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 font-[Clash_Display,sans-serif]">
            Seja um Parceiro Fio de Gala
          </h1>
          <p className="text-lg md:text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            Revenda moda masculina premium com margens atrativas. Junte-se a centenas de revendedores de sucesso em todo o Brasil.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-white text-[hsl(var(--store-dark))] hover:bg-white/90 font-semibold px-8"
              onClick={() => document.getElementById('cadastro')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Quero Revender
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white/10 font-semibold px-8"
              onClick={() => window.open('https://wa.me/5562994165785', '_blank')}
            >
              <MessageCircle className="mr-2 h-5 w-5" />
              Falar no WhatsApp
            </Button>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-4 max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-12">
            Vantagens de ser Parceiro
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {BENEFITS.map((b, i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-shadow"
              >
                <b.icon className="h-8 w-8 text-[hsl(var(--store-gold))] mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">{b.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Registration Form */}
      <section id="cadastro" className="py-16 md:py-24 bg-muted/50">
        <div className="container mx-auto px-4 max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-4">
            Cadastre-se como Revendedor
          </h2>
          <p className="text-center text-muted-foreground mb-10">
            Preencha o formulário abaixo e entraremos em contato em até 48 horas úteis.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5 bg-card border border-border rounded-xl p-6 md:p-8">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Nome Completo *</label>
              <Input value={formData.name} onChange={e => handleChange('name', e.target.value)} required />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Nome da Empresa</label>
              <Input value={formData.company} onChange={e => handleChange('company', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">CPF ou CNPJ *</label>
              <Input value={formData.document} onChange={e => handleChange('document', e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Cidade *</label>
                <Input value={formData.city} onChange={e => handleChange('city', e.target.value)} required />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Estado *</label>
                <Select value={formData.state} onValueChange={v => handleChange('state', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">WhatsApp *</label>
              <Input value={formData.whatsapp} onChange={e => handleChange('whatsapp', e.target.value)} placeholder="(00) 00000-0000" required />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Instagram</label>
              <Input value={formData.instagram} onChange={e => handleChange('instagram', e.target.value)} placeholder="@seuinstagram" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Volume Estimado de Compra Mensal</label>
              <Select value={formData.volume} onValueChange={v => handleChange('volume', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione uma opção" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="R$ 1.500 - R$ 3.000">R$ 1.500 - R$ 3.000</SelectItem>
                  <SelectItem value="R$ 3.000 - R$ 5.000">R$ 3.000 - R$ 5.000</SelectItem>
                  <SelectItem value="R$ 5.000 - R$ 10.000">R$ 5.000 - R$ 10.000</SelectItem>
                  <SelectItem value="Acima de R$ 10.000">Acima de R$ 10.000</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Mensagem (opcional)</label>
              <Textarea value={formData.message} onChange={e => handleChange('message', e.target.value)} rows={4} />
            </div>
            <Button type="submit" size="lg" className="w-full font-semibold" disabled={isSubmitting}>
              <Send className="mr-2 h-4 w-4" />
              Enviar Cadastro
            </Button>
          </form>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-10">
            Perguntas Frequentes
          </h2>
          <Accordion type="single" collapsible className="space-y-3">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="bg-card border border-border rounded-xl px-6">
                <AccordionTrigger className="text-left font-medium text-foreground hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-20 bg-[hsl(var(--store-dark))]">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ainda tem dúvidas?
          </h2>
          <p className="text-white/70 mb-8 text-lg">
            Nossa equipe está pronta para ajudar. Entre em contato pelo WhatsApp e tire todas as suas dúvidas.
          </p>
          <Button
            size="lg"
            className="bg-[hsl(142,71%,45%)] hover:bg-[hsl(142,71%,40%)] text-white font-semibold px-8"
            onClick={() => window.open('https://wa.me/5562994165785', '_blank')}
          >
            <MessageCircle className="mr-2 h-5 w-5" />
            Falar pelo WhatsApp
          </Button>
        </div>
      </section>
    </StoreLayout>
  );
};

export default WholesalePage;
