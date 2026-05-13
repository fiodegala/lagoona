import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

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

const fmtMoney = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

async function captureElement(selector: string): Promise<string | null> {
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return null;
  try {
    const canvas = await html2canvas(el, {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      useCORS: true,
    });
    return canvas.toDataURL('image/png');
  } catch (e) {
    console.error('Erro ao capturar elemento', selector, e);
    return null;
  }
}

function addImageFitted(doc: jsPDF, dataUrl: string, marginX = 14, marginY = 10) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const props = doc.getImageProperties(dataUrl);
  const maxW = pageW - marginX * 2;
  const maxH = pageH - marginY - 30;
  const ratio = Math.min(maxW / props.width, maxH / props.height);
  const w = props.width * ratio;
  const h = props.height * ratio;
  doc.addImage(dataUrl, 'PNG', marginX, marginY, w, h);
  return marginY + h + 6;
}

export async function exportABCToPDF(items: ABCItem[], periodLabel: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const today = new Date().toLocaleDateString('pt-BR');

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Curva ABC de Produtos', 14, 14);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Período: ${periodLabel} • Gerado em: ${today}`, 14, 20);

  // Stats
  const totalRevenue = items.reduce((s, i) => s + i.totalRevenue, 0);
  const totalQty = items.reduce((s, i) => s + i.quantitySold, 0);
  const countA = items.filter(i => i.classification === 'A').length;
  const countB = items.filter(i => i.classification === 'B').length;
  const countC = items.filter(i => i.classification === 'C').length;
  doc.setFontSize(9);
  doc.text(
    `Faturamento: ${fmtMoney(totalRevenue)}   |   Itens vendidos: ${totalQty}   |   Classe A: ${countA}   B: ${countB}   C: ${countC}`,
    14,
    26,
  );

  // Chart
  const chartImg = await captureElement('[data-abc-chart]');
  let nextY = 32;
  if (chartImg) {
    const props = doc.getImageProperties(chartImg);
    const maxW = doc.internal.pageSize.getWidth() - 28;
    const ratio = maxW / props.width;
    const h = Math.min(props.height * ratio, 110);
    const w = (h / props.height) * props.width;
    doc.addImage(chartImg, 'PNG', 14, nextY, w, h);
    nextY += h + 6;
  }

  // Table
  autoTable(doc, {
    startY: nextY,
    head: [['#', 'Produto', 'Qtd', 'Faturamento', '% Indiv.', '% Acum.', 'Classe']],
    body: items.map(i => [
      i.rank,
      i.productName,
      i.quantitySold,
      fmtMoney(i.totalRevenue),
      `${i.individualPercent.toFixed(2)}%`,
      `${i.accumulatedPercent.toFixed(2)}%`,
      i.classification,
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 6) {
        const v = data.cell.raw;
        if (v === 'A') data.cell.styles.fillColor = [220, 252, 231];
        if (v === 'B') data.cell.styles.fillColor = [254, 249, 195];
        if (v === 'C') data.cell.styles.fillColor = [254, 226, 226];
      }
    },
  });

  // Variations page
  const variationRows: (string | number)[][] = [];
  for (const item of items) {
    for (const v of item.variations) {
      if (item.variations.length === 1 && v.label === 'Sem variação') continue;
      variationRows.push([
        item.productName,
        v.label,
        v.quantitySold,
        fmtMoney(v.totalRevenue),
        item.totalRevenue > 0
          ? `${((v.totalRevenue / item.totalRevenue) * 100).toFixed(1)}%`
          : '0.0%',
      ]);
    }
  }
  if (variationRows.length) {
    doc.addPage();
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Variações Vendidas', 14, 14);
    autoTable(doc, {
      startY: 20,
      head: [['Produto', 'Variação', 'Qtd', 'Faturamento', '% do Produto']],
      body: variationRows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    });
  }

  doc.save(`curva-abc_${periodLabel}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export async function exportClassificationToPDF(
  products: ClassifiedProduct[],
  periodLabel: string,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const today = new Date().toLocaleDateString('pt-BR');

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Classificação Estratégica de Produtos', 14, 14);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Período: ${periodLabel} • Gerado em: ${today}`, 14, 20);

  // Capture KPI/summary section
  const kpiImg = await captureElement('[data-classification-summary]');
  let nextY = 26;
  if (kpiImg) {
    const props = doc.getImageProperties(kpiImg);
    const maxW = doc.internal.pageSize.getWidth() - 28;
    const ratio = maxW / props.width;
    const h = Math.min(props.height * ratio, 50);
    const w = (h / props.height) * props.width;
    doc.addImage(kpiImg, 'PNG', 14, nextY, w, h);
    nextY += h + 6;
  }

  const groups: Record<string, ClassifiedProduct[]> = {
    CORE: [],
    SUPORTE: [],
    ENTRADA: [],
    CONTROLADO: [],
  };
  for (const p of products) {
    if (groups[p.classification]) groups[p.classification].push(p);
  }

  const groupColors: Record<string, [number, number, number]> = {
    CORE: [220, 252, 231],
    SUPORTE: [219, 234, 254],
    ENTRADA: [254, 249, 195],
    CONTROLADO: [254, 226, 226],
  };

  let first = true;
  for (const [cls, items] of Object.entries(groups)) {
    if (!items.length) continue;
    if (!first || nextY > 180) {
      doc.addPage();
      nextY = 14;
    }
    first = false;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`${cls} — ${items.length} produtos`, 14, nextY);
    nextY += 4;
    autoTable(doc, {
      startY: nextY,
      head: [['Produto', 'Preço Médio', 'Custo Total', 'Lucro/Un', 'Margem', 'Qtd', 'Lucro Total', 'Ação']],
      body: items
        .sort((a, b) => b.totalProfit - a.totalProfit)
        .map(p => [
          p.name,
          fmtMoney(p.avgPrice),
          fmtMoney(p.totalCostPerUnit),
          fmtMoney(p.profitPerUnit),
          `${p.marginPercent.toFixed(1)}%`,
          p.qtySold,
          fmtMoney(p.totalProfit),
          p.action,
        ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: groupColors[cls], textColor: 30 },
    });
    // @ts-expect-error lastAutoTable injected by autotable
    nextY = (doc.lastAutoTable?.finalY ?? nextY) + 8;
  }

  doc.save(`classificacao-estrategica_${periodLabel}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
