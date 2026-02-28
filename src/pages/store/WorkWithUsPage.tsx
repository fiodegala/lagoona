import { useState, useRef } from 'react';
import StoreLayout from '@/components/store/StoreLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Briefcase, Upload, Send, Users, Heart, TrendingUp, Award } from 'lucide-react';

const POSITIONS = [
  'Vendedor(a) de Loja',
  'Gerente de Loja',
  'Atendimento ao Cliente',
  'Social Media / Marketing',
  'Estoquista',
  'Auxiliar Administrativo',
  'Outro',
];

const VALUES = [
  { icon: Users, title: 'Trabalho em Equipe', desc: 'Acreditamos que juntos somos mais fortes e criativos.' },
  { icon: TrendingUp, title: 'Crescimento Profissional', desc: 'Investimos no desenvolvimento contínuo de cada colaborador.' },
  { icon: Heart, title: 'Paixão por Moda', desc: 'Nosso time respira moda masculina e estilo.' },
  { icon: Award, title: 'Reconhecimento', desc: 'Valorizamos e reconhecemos o esforço de cada um.' },
];

const WorkWithUsPage = () => {
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', position: '', message: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (selected.size > maxSize) {
      toast.error('O arquivo deve ter no máximo 5MB.');
      return;
    }
    const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(selected.type)) {
      toast.error('Formato aceito: PDF ou DOC/DOCX.');
      return;
    }
    setFile(selected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.phone || !formData.position) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }

    setIsSubmitting(true);
    try {
      let resumeUrl: string | null = null;

      if (file) {
        const ext = file.name.split('.').pop();
        const fileName = `${Date.now()}-${formData.name.replace(/\s+/g, '-').toLowerCase()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(fileName, file);

        if (uploadError) throw uploadError;
        resumeUrl = fileName;
      }

      const { error } = await supabase.from('job_applications').insert({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        position: formData.position,
        message: formData.message || null,
        resume_url: resumeUrl,
      } as any);

      if (error) throw error;

      toast.success('Candidatura enviada com sucesso! Entraremos em contato.');
      setFormData({ name: '', email: '', phone: '', position: '', message: '' });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar candidatura. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <StoreLayout>
      {/* Hero */}
      <section className="bg-[hsl(var(--store-dark))] py-20 md:py-28">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-[hsl(var(--store-gold)/0.15)] mb-6">
            <Briefcase className="h-8 w-8 text-[hsl(var(--store-gold))]" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 font-[Clash_Display,sans-serif]">
            Trabalhe Conosco
          </h1>
          <p className="text-lg text-white/60 max-w-xl mx-auto">
            Faça parte do time Fio de Gala. Estamos sempre em busca de talentos apaixonados por moda e atendimento.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-3xl font-bold text-center text-foreground mb-10">Por que trabalhar na FDG?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {VALUES.map((v, i) => (
              <div key={i} className="text-center p-6 bg-card border border-border rounded-xl">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-[hsl(var(--store-gold)/0.1)] mb-4">
                  <v.icon className="h-6 w-6 text-[hsl(var(--store-gold))]" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{v.title}</h3>
                <p className="text-sm text-muted-foreground">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="py-16 md:py-24 bg-muted/50">
        <div className="container mx-auto px-4 max-w-2xl">
          <h2 className="text-3xl font-bold text-center text-foreground mb-4">
            Envie sua Candidatura
          </h2>
          <p className="text-center text-muted-foreground mb-10">
            Preencha o formulário e anexe seu currículo. Retornaremos em breve!
          </p>

          <form onSubmit={handleSubmit} className="space-y-5 bg-card border border-border rounded-xl p-6 md:p-8">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Nome Completo *</label>
              <Input value={formData.name} onChange={e => handleChange('name', e.target.value)} required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">E-mail *</label>
                <Input type="email" value={formData.email} onChange={e => handleChange('email', e.target.value)} required />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Telefone / WhatsApp *</label>
                <Input value={formData.phone} onChange={e => handleChange('phone', e.target.value)} placeholder="(00) 00000-0000" required />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Vaga de Interesse *</label>
              <Select value={formData.position} onValueChange={v => handleChange('position', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione a vaga" /></SelectTrigger>
                <SelectContent>
                  {POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Mensagem (opcional)</label>
              <Textarea value={formData.message} onChange={e => handleChange('message', e.target.value)} rows={4} placeholder="Conte um pouco sobre você..." />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Currículo (PDF ou DOC, até 5MB)</label>
              <div
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-[hsl(var(--store-gold))] transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                {file ? (
                  <p className="text-sm font-medium text-foreground">{file.name}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Clique para selecionar ou arraste o arquivo</p>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>
            <Button type="submit" size="lg" className="w-full font-semibold" disabled={isSubmitting}>
              <Send className="mr-2 h-4 w-4" />
              {isSubmitting ? 'Enviando...' : 'Enviar Candidatura'}
            </Button>
          </form>
        </div>
      </section>
    </StoreLayout>
  );
};

export default WorkWithUsPage;
