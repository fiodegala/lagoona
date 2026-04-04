import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';

interface ABCItem {
  productName: string;
  quantitySold: number;
  totalRevenue: number;
  individualPercent: number;
  accumulatedPercent: number;
  classification: 'A' | 'B' | 'C';
  rank: number;
}

interface Props {
  abcData: ABCItem[];
}

const ABCAnalysisReport = ({ abcData }: Props) => {
  const [showGuide, setShowGuide] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  const generateAIReport = async () => {
    if (abcData.length === 0) return;
    setLoadingAI(true);
    try {
      const countA = abcData.filter(i => i.classification === 'A').length;
      const countB = abcData.filter(i => i.classification === 'B').length;
      const countC = abcData.filter(i => i.classification === 'C').length;
      const totalRevenue = abcData.reduce((s, i) => s + i.totalRevenue, 0);

      const top20 = abcData.slice(0, 20).map(i =>
        `${i.rank}. ${i.productName} — Faturamento: R$${i.totalRevenue.toFixed(2)} (${i.individualPercent.toFixed(1)}%) — Classe ${i.classification}`
      ).join('\n');

      const prompt = `Você é um consultor especialista em gestão de estoque e varejo de moda. Analise os dados da Curva ABC abaixo e forneça um relatório completo em português com:

1. **Resumo Executivo** — visão geral da situação
2. **Análise da Classe A** — produtos que representam 80% do faturamento, estratégias para maximizar vendas
3. **Análise da Classe B** — produtos intermediários, como promovê-los para Classe A
4. **Análise da Classe C** — produtos de baixo giro, decisões sobre manter ou descontinuar
5. **Recomendações Estratégicas** — ações concretas para otimizar estoque e vendas
6. **Alertas e Riscos** — pontos de atenção identificados

Dados:
- Total de SKUs: ${abcData.length}
- Classe A: ${countA} SKUs (80% do faturamento)
- Classe B: ${countB} SKUs (15% do faturamento)
- Classe C: ${countC} SKUs (5% do faturamento)
- Faturamento total: R$${totalRevenue.toFixed(2)}

Top 20 produtos:
${top20}

Use formatação Markdown com títulos, bullet points e destaques. Seja específico e mencione produtos pelo nome quando relevante.`;

      const { data, error } = await supabase.functions.invoke('store-chat', {
        body: { messages: [{ role: 'user', content: prompt }] },
      });

      if (error) throw error;
      setAiReport(data?.reply || data?.message || 'Não foi possível gerar o relatório.');
    } catch (err) {
      console.error('Erro ao gerar relatório IA:', err);
      setAiReport('Erro ao gerar relatório. Tente novamente.');
    } finally {
      setLoadingAI(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Guia Educativo */}
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => setShowGuide(!showGuide)}
        >
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              O que é a Curva ABC?
            </span>
            {showGuide ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CardTitle>
        </CardHeader>
        {showGuide && (
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              A <strong className="text-foreground">Curva ABC</strong> é uma metodologia baseada no <strong className="text-foreground">Princípio de Pareto (80/20)</strong>, que classifica os produtos em três categorias de acordo com sua contribuição para o faturamento total:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border border-green-500/30 bg-green-500/5">
                <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30 mb-2">Classe A</Badge>
                <p className="font-medium text-foreground">≈ 20% dos produtos</p>
                <p>Responsáveis por <strong className="text-foreground">80%</strong> do faturamento. São os itens mais importantes e devem receber atenção máxima em estoque, exposição e marketing.</p>
              </div>
              <div className="p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/30 mb-2">Classe B</Badge>
                <p className="font-medium text-foreground">≈ 30% dos produtos</p>
                <p>Responsáveis por <strong className="text-foreground">15%</strong> do faturamento. São itens intermediários com potencial de crescimento. Merecem atenção moderada.</p>
              </div>
              <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/5">
                <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/30 mb-2">Classe C</Badge>
                <p className="font-medium text-foreground">≈ 50% dos produtos</p>
                <p>Responsáveis por <strong className="text-foreground">5%</strong> do faturamento. Itens de baixo giro. Avalie se vale manter em estoque ou descontinuar.</p>
              </div>
            </div>
            <div className="p-4 rounded-lg border bg-muted/50">
              <p className="font-medium text-foreground mb-2">Como usar essa análise:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Classe A:</strong> Nunca deixe faltar. Priorize reposição, negocie melhores condições com fornecedores.</li>
                <li><strong>Classe B:</strong> Crie promoções e combos para aumentar o giro. Teste em destaque na loja.</li>
                <li><strong>Classe C:</strong> Faça liquidações, inclua em combos ou descontinue. Evite estoque parado.</li>
                <li>Reavalie mensalmente para acompanhar mudanças de tendência.</li>
              </ul>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Relatório IA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Análise Inteligente com IA
            </span>
            <Button
              size="sm"
              onClick={generateAIReport}
              disabled={loadingAI || abcData.length === 0}
            >
              {loadingAI ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Analisando...
                </>
              ) : aiReport ? 'Gerar Novamente' : 'Gerar Relatório'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!aiReport && !loadingAI && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Clique em "Gerar Relatório" para que a IA analise seus dados e forneça recomendações estratégicas personalizadas.
            </p>
          )}
          {loadingAI && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          {aiReport && !loadingAI && (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{aiReport}</ReactMarkdown>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ABCAnalysisReport;
