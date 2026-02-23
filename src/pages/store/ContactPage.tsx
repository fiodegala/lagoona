import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Clock, Send, MessageCircle, Instagram, Facebook } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import StoreLayout from '@/components/store/StoreLayout';

const ContactPage = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simular envio
    await new Promise((resolve) => setTimeout(resolve, 1500));

    toast.success('Mensagem enviada com sucesso! Responderemos em breve.');
    setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
    setIsSubmitting(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const contactInfo = [
    {
      icon: Mail,
      title: 'E-mail',
      content: 'contato@fiodegala.com.br',
      link: 'mailto:contato@fiodegala.com.br',
    },
    {
      icon: Phone,
      title: 'WhatsApp',
      content: '(11) 99999-9999',
      link: 'https://wa.me/5511999999999',
    },
    {
      icon: MapPin,
      title: 'Endereço',
      content: 'São Paulo, SP - Brasil',
      link: null,
    },
    {
      icon: Clock,
      title: 'Horário de Atendimento',
      content: 'Seg - Sex: 9h às 18h',
      link: null,
    },
  ];

  return (
    <StoreLayout>
      <div className="min-h-screen">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-store-secondary to-store-secondary/50 py-16 md:py-20">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-store-accent mb-4">
              Fale Conosco
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Estamos aqui para ajudar! Entre em contato conosco por qualquer um dos nossos canais.
            </p>
          </div>
        </section>

        {/* Contact Section */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12">
              {/* Contact Form */}
              <div className="bg-card rounded-2xl p-6 md:p-8 shadow-sm border">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-store-primary/10 rounded-lg flex items-center justify-center">
                    <Send className="h-5 w-5 text-store-primary" />
                  </div>
                  <h2 className="text-2xl font-bold text-store-accent">
                    Envie uma Mensagem
                  </h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome Completo *</Label>
                      <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Seu nome"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">E-mail *</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="seu@email.com"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subject">Assunto *</Label>
                      <Input
                        id="subject"
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                        placeholder="Como podemos ajudar?"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Mensagem *</Label>
                    <Textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      placeholder="Escreva sua mensagem aqui..."
                      rows={5}
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-store-primary hover:bg-store-primary/90 text-store-accent font-semibold"
                  >
                    {isSubmitting ? 'Enviando...' : 'Enviar Mensagem'}
                  </Button>
                </form>
              </div>

              {/* Contact Info */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-store-accent mb-6">
                    Informações de Contato
                  </h2>
                  <div className="space-y-4">
                    {contactInfo.map((info, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-4 p-4 bg-store-secondary/30 rounded-xl"
                      >
                        <div className="w-10 h-10 bg-store-primary/10 rounded-lg flex items-center justify-center shrink-0">
                          <info.icon className="h-5 w-5 text-store-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-store-accent">{info.title}</p>
                          {info.link ? (
                            <a
                              href={info.link}
                              className="text-muted-foreground hover:text-store-primary transition-colors"
                              target={info.link.startsWith('http') ? '_blank' : undefined}
                              rel={info.link.startsWith('http') ? 'noopener noreferrer' : undefined}
                            >
                              {info.content}
                            </a>
                          ) : (
                            <p className="text-muted-foreground">{info.content}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Social Media */}
                <div className="bg-card rounded-2xl p-6 border">
                  <h3 className="text-lg font-semibold text-store-accent mb-4">
                    Siga-nos nas Redes Sociais
                  </h3>
                  <div className="flex gap-3">
                    <a
                      href="https://instagram.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-12 h-12 bg-store-secondary rounded-lg flex items-center justify-center hover:bg-store-primary/20 transition-colors"
                    >
                      <Instagram className="h-5 w-5 text-store-accent" />
                    </a>
                    <a
                      href="https://facebook.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-12 h-12 bg-store-secondary rounded-lg flex items-center justify-center hover:bg-store-primary/20 transition-colors"
                    >
                      <Facebook className="h-5 w-5 text-store-accent" />
                    </a>
                    <a
                      href="https://wa.me/5511999999999"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-12 h-12 bg-store-secondary rounded-lg flex items-center justify-center hover:bg-store-primary/20 transition-colors"
                    >
                      <MessageCircle className="h-5 w-5 text-store-accent" />
                    </a>
                  </div>
                </div>

                {/* FAQ Shortcut */}
                <div className="bg-gradient-to-br from-store-primary/10 to-store-primary/5 rounded-2xl p-6 border border-store-primary/20">
                  <h3 className="text-lg font-semibold text-store-accent mb-2">
                    Dúvidas Frequentes?
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Confira nossa seção de perguntas frequentes para respostas rápidas.
                  </p>
                  <Button asChild variant="outline" className="border-store-primary text-store-primary hover:bg-store-primary hover:text-store-accent">
                    <Link to="/faq">Ver FAQ</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </StoreLayout>
  );
};

export default ContactPage;
