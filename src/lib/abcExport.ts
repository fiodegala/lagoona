import * as XLSX from 'xlsx';

interface VariationBreakdown {
  key: string;
  label: string;
  quantitySold: number;
  totalRevenue: number;
}

interface ABCItem {
  productName: string;
  productId: string;
  quantitySold: number;
  totalRevenue: number;
  individualPercent: number;
  accumulatedPercent: number;
  classification: 'A' | 'B' | 'C';
  rank: number;
  variations: VariationBreakdown[];
}

const fmtMoney = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function exportABCToXLSX(items: ABCItem[], periodLabel: string) {
  const wb = XLSX.utils.book_new();

  const summary = items.map(i => ({
    '#': i.rank,
    Produto: i.productName,
    'Qtd Vendida': i.quantitySold,
    Faturamento: i.totalRevenue,
    'Faturamento (BRL)': fmtMoney(i.totalRevenue),
    '% Individual': Number(i.individualPercent.toFixed(2)),
    '% Acumulado': Number(i.accumulatedPercent.toFixed(2)),
    Classe: i.classification,
    Variações: i.variations.length,
  }));
  const ws1 = XLSX.utils.json_to_sheet(summary);
  XLSX.utils.book_append_sheet(wb, ws1, 'Curva ABC');

  const variations: Record<string, string | number>[] = [];
  for (const item of items) {
    for (const v of item.variations) {
      variations.push({
        Produto: item.productName,
        Variação: v.label,
        'Qtd Vendida': v.quantitySold,
        Faturamento: v.totalRevenue,
        'Faturamento (BRL)': fmtMoney(v.totalRevenue),
        '% do Produto':
          item.totalRevenue > 0
            ? Number(((v.totalRevenue / item.totalRevenue) * 100).toFixed(2))
            : 0,
        Classe: item.classification,
      });
    }
  }
  if (variations.length) {
    const ws2 = XLSX.utils.json_to_sheet(variations);
    XLSX.utils.book_append_sheet(wb, ws2, 'Variações');
  }

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `curva-abc_${periodLabel}_${today}.xlsx`);
}

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
  classification: string;
  action: string;
}

export function exportClassificationToXLSX(
  products: ClassifiedProduct[],
  periodLabel: string,
) {
  const wb = XLSX.utils.book_new();
  const rows = products.map(p => ({
    Produto: p.name,
    'Preço Médio': Number(p.avgPrice.toFixed(2)),
    'Custo Produto': Number(p.cost.toFixed(2)),
    'Custo Variável': Number(p.variableCost.toFixed(2)),
    'Custo Total/Un': Number(p.totalCostPerUnit.toFixed(2)),
    'Lucro/Un': Number(p.profitPerUnit.toFixed(2)),
    'Margem %': Number(p.marginPercent.toFixed(2)),
    'Qtd Vendida': p.qtySold,
    Faturamento: Number(p.revenue.toFixed(2)),
    'Lucro Total': Number(p.totalProfit.toFixed(2)),
    Classificação: p.classification,
    Ação: p.action,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Classificação Estratégica');

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `classificacao-estrategica_${periodLabel}_${today}.xlsx`);
}
