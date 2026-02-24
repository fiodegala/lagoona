import { useState, useEffect } from 'react';
import type { Json } from '@/integrations/supabase/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Save, RotateCcw, Info, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const DEFAULT_TEMPLATES: Record<string, string> = {
  confirmed: 'Olá {nome}! ✅\n\nSeu pedido foi *confirmado* com sucesso!\n\nEstamos preparando tudo para você. 😊',
  processing: 'Olá {nome}! 📦\n\nSeu pedido está sendo *preparado*!\n\nEm breve ele será enviado. Fique de olho! 🚀',
  shipped: 'Olá {nome}! 🚚\n\nSeu pedido foi *enviado*!\n\nVocê receberá o código de rastreio em breve. 😊',
  delivered: 'Olá {nome}! 🎉\n\nSeu pedido foi *entregue*!\n\nEsperamos que você aproveite! Se precisar de algo, estamos à disposição. 💛',
  cancelled: 'Olá {nome}.\n\nInformamos que seu pedido foi *cancelado*.\n\nSe tiver dúvidas, entre em contato conosco. 🙏',
  tracking: 'Olá {nome}! 🎉\n\nSeu pedido foi enviado!\n\n📦 *Transportadora:* {transportadora}\n🔍 *Código de rastreio:* {codigo}\n\n🔗 Acompanhe aqui: {url}\n\nQualquer dúvida, estamos à disposição! 😊',
};

const TEMPLATE_LABELS: Record<string, string> = {
  confirmed: 'Pedido Confirmado',
  processing: 'Em Preparo',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
  tracking: 'Rastreio',
};

const TEMPLATE_VARIABLES: Record<string, string[]> = {
  confirmed: ['{nome}'],
  processing: ['{nome}'],
  shipped: ['{nome}'],
  delivered: ['{nome}'],
  cancelled: ['{nome}'],
  tracking: ['{nome}', '{transportadora}', '{codigo}', '{url}'],
};

const SAMPLE_VALUES: Record<string, string> = {
  '{nome}': 'Maria Silva',
  '{transportadora}': 'Correios',
  '{codigo}': 'QR123456789BR',
  '{url}': 'https://rastreio.correios.com.br/QR123456789BR',
};

function formatPreview(template: string): string {
  let text = template;
  for (const [key, value] of Object.entries(SAMPLE_VALUES)) {
    text = text.split(key).join(value);
  }
  return text;
}

function renderWhatsAppText(text: string) {
  // Convert *bold* to <strong>, preserve newlines
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const parts = line.split(/(\*[^*]+\*)/g);
    return (
      <span key={i}>
        {i > 0 && <br />}
        {parts.map((part, j) => {
          if (part.startsWith('*') && part.endsWith('*')) {
            return <strong key={j}>{part.slice(1, -1)}</strong>;
          }
          return <span key={j}>{part}</span>;
        })}
      </span>
    );
  });
}

const WhatsAppTemplatesSettings = () => {
  const [templates, setTemplates] = useState<Record<string, string>>({ ...DEFAULT_TEMPLATES });
  const [savedTemplates, setSavedTemplates] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const { data } = await supabase
        .from('store_config')
        .select('value')
        .eq('key', 'whatsapp_templates')
        .maybeSingle();

      if (data?.value) {
        const saved = data.value as Record<string, string>;
        setSavedTemplates(saved);
        setTemplates({ ...DEFAULT_TEMPLATES, ...saved });
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Only save templates that differ from defaults
      const customTemplates: Record<string, string> = {};
      for (const [key, value] of Object.entries(templates)) {
        if (value !== DEFAULT_TEMPLATES[key]) {
          customTemplates[key] = value;
        }
      }

      const { data: existing } = await supabase
        .from('store_config')
        .select('id')
        .eq('key', 'whatsapp_templates')
        .maybeSingle();

      if (existing) {
        await supabase
          .from('store_config')
          .update({ value: customTemplates as unknown as Json })
          .eq('key', 'whatsapp_templates');
      } else {
        await supabase
          .from('store_config')
          .insert([{ key: 'whatsapp_templates', value: customTemplates as unknown as Json, is_public: false }]);
      }

      setSavedTemplates(customTemplates);
      toast.success('Templates de WhatsApp salvos com sucesso!');
    } catch (error) {
      console.error('Error saving templates:', error);
      toast.error('Erro ao salvar templates');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = (key: string) => {
    setTemplates(prev => ({ ...prev, [key]: DEFAULT_TEMPLATES[key] }));
  };

  const handleResetAll = () => {
    setTemplates({ ...DEFAULT_TEMPLATES });
    toast.info('Templates restaurados para o padrão');
  };

  const hasChanges = Object.keys(templates).some(key => {
    const currentCustom = templates[key] !== DEFAULT_TEMPLATES[key] ? templates[key] : undefined;
    const savedCustom = savedTemplates[key];
    return currentCustom !== savedCustom;
  });

  if (isLoading) {
    return null;
  }

  return (
    <Card className="card-elevated">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-success" />
              Templates de WhatsApp
            </CardTitle>
            <CardDescription className="mt-1">
              Personalize as mensagens enviadas automaticamente via WhatsApp
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleResetAll}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Restaurar padrão
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!hasChanges || isSaving}>
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {isSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="confirmed">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0 mb-4">
            {Object.entries(TEMPLATE_LABELS).map(([key, label]) => (
              <TabsTrigger
                key={key}
                value={key}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-3 py-1.5 text-xs border"
              >
                {label}
                {templates[key] !== DEFAULT_TEMPLATES[key] && (
                  <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-warning inline-block" />
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(TEMPLATE_LABELS).map(([key, label]) => (
            <TabsContent key={key} value={key} className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Mensagem: {label}</Label>
                <div className="flex items-center gap-2">
                  {templates[key] !== DEFAULT_TEMPLATES[key] && (
                    <Badge variant="outline" className="text-xs text-warning border-warning">
                      Personalizado
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReset(key)}
                    className="h-7 text-xs"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Padrão
                  </Button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Editor */}
                <div className="space-y-3">
                  <Textarea
                    value={templates[key]}
                    onChange={(e) => setTemplates(prev => ({ ...prev, [key]: e.target.value }))}
                    rows={10}
                    className="font-mono text-sm"
                  />

                  <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                    <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p className="font-medium">Variáveis disponíveis:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {TEMPLATE_VARIABLES[key].map(v => (
                          <Tooltip key={v}>
                            <TooltipTrigger asChild>
                              <code className="bg-background px-1.5 py-0.5 rounded border text-xs cursor-help">
                                {v}
                              </code>
                            </TooltipTrigger>
                            <TooltipContent>
                              {v === '{nome}' && 'Nome do cliente'}
                              {v === '{transportadora}' && 'Nome da transportadora'}
                              {v === '{codigo}' && 'Código de rastreio'}
                              {v === '{url}' && 'URL de rastreio'}
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                      <p>Use <code className="bg-background px-1 rounded border">*texto*</code> para negrito.</p>
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Eye className="h-4 w-4" />
                    Pré-visualização
                  </div>
                  <div className="rounded-xl bg-[hsl(var(--muted))] p-4 min-h-[200px]">
                    {/* WhatsApp-style bubble */}
                    <div className="max-w-[280px] ml-auto">
                      <div className="bg-[hsl(142,70%,87%)] dark:bg-[hsl(142,40%,25%)] rounded-xl rounded-tr-sm px-3 py-2 shadow-sm">
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
                          {renderWhatsAppText(formatPreview(templates[key]))}
                        </p>
                        <p className="text-[10px] text-muted-foreground text-right mt-1">
                          {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ✓✓
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default WhatsAppTemplatesSettings;
