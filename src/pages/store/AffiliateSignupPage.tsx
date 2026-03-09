import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, CheckCircle, TrendingUp, DollarSign, Share2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import StoreLayout from '@/components/store/StoreLayout';
import { supabase } from '@/integrations/supabase/client';
import { generateReferralCode } from '@/lib/affiliateUtils';
import { useAuth } from '@/contexts/AuthContext';

const AffiliateSignupPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', document: '', password: '', confirmPassword: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone || !form.password) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }
    if (form.password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error('As senhas não conferem.');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Create auth account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { full_name: form.name },
          emailRedirectTo: window.location.origin,
        },
      });

      if (authError) {
        if (authError.message?.includes('already registered')) {
          toast.error('Este e-mail já possui uma conta. Faça login e tente novamente.');
        } else {
          throw authError;
        }
        return;
      }

      const userId = authData.user?.id;

      // 2. Create affiliate record
      const referralCode = generateReferralCode(form.name);
      const { error: affError } = await supabase.from('affiliates').insert({
        name: form.name,
        email: form.email,
        phone: form.phone,
        document: form.document || null,
        referral_code: referralCode,
        user_id: userId || null,
      });

      if (affError) {
        if (affError.code === '23505') {
          toast.error('Este e-mail já está cadastrado como afiliado.');
        } else {
          throw affError;
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

  // If already logged in, check if already an affiliate
  const handleExistingUser = async () => {
    if (!user) {
      navigate('/conta/login');
      return;
    }
    setIsLoading(true);
    try {
      const { data: existing } = await supabase.from('affiliates').select('id').eq('user_id', user.id).maybeSingle();
      if (existing) {
        navigate('/afiliados/painel');
        return;
      }
      // Show message that they need to fill the form
      toast.info('Preencha o formulário abaixo para se cadastrar como afiliado.');
    } catch (err) {
      console.error(err);
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
          <p className="text-muted-foreground mb-4">
            Seu cadastro foi recebido e será analisado pela nossa equipe.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Verifique seu e-mail para confirmar sua conta. Após a aprovação, você poderá acessar seu painel em{' '}
            <Link to="/afiliados/painel" className="text-primary underline">Painel do Afiliado</Link>.
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

        {/* If already logged in, show shortcut */}
        {user && (
          <div className="text-center mb-6">
            <Button variant="outline" onClick={handleExistingUser} disabled={isLoading}>
              Já tenho conta — Verificar meu cadastro de afiliado
            </Button>
          </div>
        )}

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
              <div>
                <Label htmlFor="password">Senha *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Cadastrando...' : 'Quero ser Afiliado'}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Já é afiliado?{' '}
                <Link to="/conta/login" className="text-primary underline">Faça login</Link>
                {' '}e acesse seu{' '}
                <Link to="/afiliados/painel" className="text-primary underline">painel</Link>.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </StoreLayout>
  );
};

export default AffiliateSignupPage;
