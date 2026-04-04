import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Star, ShieldCheck, DoorOpen, Ban } from 'lucide-react';

interface ABCItem {
  productName: string;
  productId: string;
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

const COST_MAP: Record<string, number> = {
  'camisa manga longa': 58,
  'camiseta básica': 28,
  'camiseta basica': 28,
  'calça alfaiataria': 63,
  'calca alfaiataria': 63,
  'bermuda alfaiataria': 45,
  'polo de zíper': 48,
  'polo de ziper': 48,
  'calça cigarrete': 58,
  'calca cigarrete': 58,
  'gola média': 36,
  'gola media': 36,
  'calça slim': 64,
  'calca slim': 64,
  'bermuda jeans': 49,
  'calça tradicional': 60,
  'calca tradicional': 60,
  'cueca': 8.5,
  'gola polo': 50,
  'camisa manga curta': 58,
  'short': 60,
  'camiseta texturizada': 47,
  'camiseta básica texturizada': 47,
  'camiseta basica texturizada': 47,
  'camiseta tech': 44,
  'camiseta básica tech': 44,
  'camiseta basica tech': 44,
  'calça social': 142,
  'calca social': 142,
  'calça social de regulagem': 142,
  'calca social de regulagem': 142,
  'cinto': 27,
  'sapato': 190,
  'gola média texturizada': 35,
  'gola media texturizada': 35,
  'gola media tech': 36,
  'meia': 12,
  'meia invisível': 12,
  'meia invisivel': 12,
  'meia socket': 12,
  'blazer': 120,
  'blazer social': 120,
  'sneaker': 190,
  'derby': 190,
  'oxford': 190,
  'slip on': 190,
  'sueter': 48,
  'bermuda alfaiataria texturizada': 45,
  'short shep': 60,
  'short tech': 60,
  'short de linho': 60,
  'short de linho trancoso': 60,
  'cinto de couro': 27,
  'cinto elastico': 27,
  'cinto elástico': 27,
  'cinto dupla face': 27,
  'kit cueca': 25.5,
  'gola polo trico': 50,
  'gola polo viena': 50,
  'gola polo versailes': 50,
  'gola polo tecnologia botão': 50,
  'gola polo tecnologia botao': 50,
  'gola polo texturizada zíper': 48,
  'gola polo texturizada ziper': 48,
  'gola polo confort': 50,
  'gola polo tecnologia zíper': 48,
  'gola polo tecnologia ziper': 48,
  'camisa manga longa tecnologia': 58,
  'camisa manga longa de linho': 58,
  'camisa manga curta de linho': 58,
  'camisa manga curta tecnologia': 58,
  'calça jeans': 64,
  'calca jeans': 64,
  'calça alfaiataria tecnologia': 63,
  'calca alfaiataria tecnologia': 63,
  'calça alfaiataria lagoona': 63,
  'calça alfaitaria social': 63,
  'calça tradicional lagoona': 60,
  'calca tradicional lagoona': 60,
  'calça trdicional lagoona': 60,
  'bermuda alfaiataria de tecnologia': 45,
};

const FIXED_COST_PER_UNIT = 27.56;
const VARIABLE_COST_PERCENT = 0.11;

function findCost(productName: string): number | null {
  const lower = productName.toLowerCase().trim();

  // Direct match
  if (COST_MAP[lower] !== undefined) return COST_MAP[lower];

  // Partial match: find the longest key that is contained in the product name
  let bestMatch: string | null = null;
  let bestLen = 0;
  for (const key of Object.keys(COST_MAP)) {
    if (lower.includes(key) && key.length > bestLen) {
      bestMatch = key;
      bestLen = key.length;
    }
  }
  if (bestMatch) return COST_MAP[bestMatch];

  // Try reverse: key contains product name
  for (const key of Object.keys(COST_MAP)) {
    if (key.includes(lower) && lower.length > 3) {
      return COST_MAP[key];
    }
  }

  return null;
}

type Classification = 'CORE' | 'SUPORTE' | 'ENTRADA' | 'CONTROLADO';

interface ClassifiedProduct {
  name: string;
  avgPrice: number;
  cost: number;
  qtySold: number;
  revenue: number;
  variableCost: number;
  totalCostPerUnit: number;
  profitPerUnit: number;
  marginPercent: number;
  totalProfit: number;
  classification: Classification;
  action: string;
}

function classify(marginPercent: number, qtySold: number, totalProfit: number, medianQty: number): { classification: Classification; action: string } {
  if (marginPercent < 0 || totalProfit < 0) {
    return { classification: 'CONTROLADO', action: 'Subir preço ou retirar do mix' };
  }
  if (marginPercent < 10) {
    return { classification: 'CONTROLADO', action: 'Revisar precificação ou montar em combo' };
  }
  if (marginPercent >= 25 && totalProfit > 0 && qtySold >= medianQty) {
    return { classification: 'CORE', action: 'Manter e investir em divulgação' };
  }
  if (marginPercent >= 25 && qtySold < medianQty) {
    return { classification: 'SUPORTE', action: 'Manter e usar em cross-sell' };
  }
  if (marginPercent >= 10 && marginPercent < 25 && qtySold >= medianQty) {
    return { classification: 'ENTRADA', action: 'Alto giro, manter preço competitivo' };
  }
  if (marginPercent >= 10 && marginPercent < 25) {
    return { classification: 'SUPORTE', action: 'Avaliar aumento de preço ou combo' };
  }
  return { classification: 'SUPORTE', action: 'Manter e monitorar' };
}

const classConfig: Record<Classification, { color: string; icon: typeof Star; label: string }> = {
  CORE: { color: 'bg-green-500/10 text-green-700 border-green-500/30', icon: Star, label: 'CORE' },
  SUPORTE: { color: 'bg-blue-500/10 text-blue-700 border-blue-500/30', icon: ShieldCheck, label: 'SUPORTE' },
  ENTRADA: { color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30', icon: DoorOpen, label: 'ENTRADA' },
  CONTROLADO: { color: 'bg-red-500/10 text-red-700 border-red-500/30', icon: Ban, label: 'CONTROLADO' },
};

const ProductClassificationTab = ({ abcData }: Props) => {
  const classifiedProducts = useMemo<ClassifiedProduct[]>(() => {
    if (!abcData.length) return [];

    const products: ClassifiedProduct[] = [];
    for (const item of abcData) {
      const cost = findCost(item.productName);
      if (cost === null) continue;

      const avgPrice = item.totalRevenue / item.quantitySold;
      const variableCost = avgPrice * VARIABLE_COST_PERCENT;
      const totalCostPerUnit = cost + variableCost + FIXED_COST_PER_UNIT;
      const profitPerUnit = avgPrice - totalCostPerUnit;
      const marginPercent = (profitPerUnit / avgPrice) * 100;
      const totalProfit = profitPerUnit * item.quantitySold;

      products.push({
        name: item.productName,
        avgPrice,
        cost,
        qtySold: item.quantitySold,
        revenue: item.totalRevenue,
        variableCost,
        totalCostPerUnit,
        profitPerUnit,
        marginPercent,
        totalProfit,
        classification: 'CORE', // placeholder
        action: '',
      });
    }

    // Calculate median qty for classification
    const sortedQty = products.map(p => p.qtySold).sort((a, b) => a - b);
    const medianQty = sortedQty[Math.floor(sortedQty.length / 2)] || 1;

    for (const p of products) {
      const { classification, action } = classify(p.marginPercent, p.qtySold, p.totalProfit, medianQty);
      p.classification = classification;
      p.action = action;
    }

    return products.sort((a, b) => b.totalProfit - a.totalProfit);
  }, [abcData]);

  const stats = useMemo(() => {
    const grouped: Record<Classification, ClassifiedProduct[]> = { CORE: [], SUPORTE: [], ENTRADA: [], CONTROLADO: [] };
    for (const p of classifiedProducts) {
      grouped[p.classification].push(p);
    }
    const losers = classifiedProducts.filter(p => p.profitPerUnit < 0);
    const totalProfit = classifiedProducts.reduce((s, p) => s + p.totalProfit, 0);
    return { grouped, losers, totalProfit };
  }, [classifiedProducts]);

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const pct = (v: number) => `${v.toFixed(1)}%`;

  if (!classifiedProducts.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Nenhum dado disponível para classificação. Verifique se há vendas no período.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-xs text-muted-foreground">Lucro Total Estimado</div>
            <div className={`text-lg font-bold ${stats.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {fmt(stats.totalProfit)}
            </div>
          </CardContent>
        </Card>
        {(['CORE', 'SUPORTE', 'ENTRADA', 'CONTROLADO'] as Classification[]).map(cls => {
          const cfg = classConfig[cls];
          const items = stats.grouped[cls];
          const Icon = cfg.icon;
          return (
            <Card key={cls} className={`border ${cfg.color.split(' ').find(c => c.startsWith('border-'))}`}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">{cls}</span>
                </div>
                <div className="text-lg font-bold text-foreground">{items.length} SKUs</div>
                <div className="text-xs text-muted-foreground">
                  {fmt(items.reduce((s, p) => s + p.totalProfit, 0))} lucro
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Grouped cards by classification */}
      {(['CORE', 'SUPORTE', 'ENTRADA', 'CONTROLADO'] as Classification[]).map(cls => {
        const cfg = classConfig[cls];
        const items = stats.grouped[cls];
        if (!items.length) return null;
        const Icon = cfg.icon;

        return (
          <Card key={cls}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {cls} — {items.length} produtos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-auto max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Preço Médio</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                      <TableHead className="text-right">Lucro/Un</TableHead>
                      <TableHead className="text-right">Margem</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Lucro Total</TableHead>
                      <TableHead>Ação Sugerida</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.sort((a, b) => b.totalProfit - a.totalProfit).map(p => (
                      <TableRow key={p.name}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-right">{fmt(p.avgPrice)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{fmt(p.totalCostPerUnit)}</TableCell>
                        <TableCell className={`text-right font-medium ${p.profitPerUnit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {fmt(p.profitPerUnit)}
                        </TableCell>
                        <TableCell className={`text-right ${p.marginPercent >= 25 ? 'text-green-600' : p.marginPercent >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {pct(p.marginPercent)}
                        </TableCell>
                        <TableCell className="text-right">{p.qtySold}</TableCell>
                        <TableCell className={`text-right font-medium ${p.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {fmt(p.totalProfit)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[180px]">{p.action}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Products with loss */}
      {stats.losers.length > 0 && (
        <Card className="border-red-500/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              ⚠️ Produtos com Prejuízo — Atenção Imediata
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.losers.sort((a, b) => a.totalProfit - b.totalProfit).map(p => (
                <div key={p.name} className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                  <div>
                    <span className="font-medium text-foreground">{p.name}</span>
                    <div className="text-xs text-muted-foreground">
                      Preço {fmt(p.avgPrice)} → Custo total {fmt(p.totalCostPerUnit)} | Prejuízo de {fmt(p.profitPerUnit)} por unidade
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-red-600 font-bold">{fmt(p.totalProfit)}</div>
                    <div className="text-xs text-red-500">{p.qtySold} un vendidas</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Formula explanation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">📐 Fórmula Utilizada</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p><strong className="text-foreground">Lucro = Preço de venda − (Preço × 11%) − Custo do produto − R$ 27,56</strong></p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <p className="font-medium text-foreground">Classificações:</p>
              <div className="flex items-center gap-2"><Badge variant="outline" className={classConfig.CORE.color}>CORE</Badge> Alta margem + alto impacto no lucro</div>
              <div className="flex items-center gap-2"><Badge variant="outline" className={classConfig.SUPORTE.color}>SUPORTE</Badge> Margem média, ajuda na venda</div>
              <div className="flex items-center gap-2"><Badge variant="outline" className={classConfig.ENTRADA.color}>ENTRADA</Badge> Baixa margem + alto volume</div>
              <div className="flex items-center gap-2"><Badge variant="outline" className={classConfig.CONTROLADO.color}>CONTROLADO</Badge> Margem muito baixa ou prejuízo</div>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-foreground">Custos considerados:</p>
              <p>• Custos variáveis: 11% do preço de venda</p>
              <p>• Custo fixo por peça: R$ 27,56</p>
              <p>• Custo de aquisição: conforme tabela informada</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductClassificationTab;
