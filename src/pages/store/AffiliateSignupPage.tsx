import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, CheckCircle, TrendingUp, DollarSign, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import StoreLayout from '@/components/store/StoreLayout';
import { supabase } from '@/integrations/supabase/client';
import { generateReferralCode } from '@/lib/affiliateUtils';

const AffiliateSignupPage = () => {
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', document: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }
    setIsLoading(true);
    try {
      const referralCode = generateReferralCode(form.name);
      const { error } = await supabase.from('affiliates').insert({
        name: form.name,
        email: form.email,
        phone: form.phone,
        document: form.document || null,
        referral_code: referralCode,
      });
      if (error) {
        if (error.code === '23505') {
          toast.error('Este e-mail já está cadastrado como afiliado.');
        } else {
          throw error;
        }
        return;
      }
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar cadastro. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const benefits = [
    { icon: Share2, title: 'Link Exclusivo', desc: 'Receba seu link personalizado para compartilhar' },
    { icon: TrendingUp, title: 'Comissão por Venda', desc: 'Ganhe % sobre cada venda realizada pelo seu link' },
    { icon: DollarSign, title: 'Saque Fácil', desc: 'Solicite o pagamento das suas comissões via PIX' },
  ];

  if (submitted) {
    return (
      <StoreLayout>
        <div className="container mx-auto px-4 py-16 text-center max-w-lg">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Cadastro Enviado!</h1>
          <p className="text-muted-foreground mb-6">
            Seu cadastro foi recebido e será analisado. Você receberá uma confirmação por e-mail assim que for aprovado.
          </p>
          <Link to="/">
            <Button>Voltar à Loja</Button>
          </Link>
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center mb-10">
          <Users className="h-12 w-12 mx-auto mb-3 text-primary" />
          <h1 className="text-3xl font-bold mb-2">Programa de Afiliados</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Indique nossos produtos e ganhe comissão sobre cada venda realizada através do seu link exclusivo.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-10">
          {benefits.map((b) => (
            <Card key={b.title} className="text-center">
              <CardContent className="pt-6">
                <b.icon className="h-8 w-8 mx-auto mb-2 text-primary" />
                <h3 className="font-semibold mb-1">{b.title}</h3>
                <p className="text-sm text-muted-foreground">{b.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="max-w-lg mx-auto">
          <CardHeader>
            <CardTitle>Cadastre-se como Afiliado</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome Completo *</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={100} />
              </div>
              <div>
                <Label htmlFor="email">E-mail *</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required maxLength={255} />
              </div>
              <div>
                <Label htmlFor="phone">WhatsApp *</Label>
                <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required maxLength={20} placeholder="(00) 00000-0000" />
              </div>
              <div>
                <Label htmlFor="document">CPF/CNPJ</Label>
                <Input id="document" value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} maxLength={18} />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Enviando...' : 'Quero ser Afiliado'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </StoreLayout>
  );
};

export default AffiliateSignupPage;
