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

export async function exportABCToPDF(items: ABCItem[], periodLabel: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const today = new Date().toLocaleDateString('pt-BR');

  // Compact header
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Curva ABC de Produtos', 10, 10);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Período: ${periodLabel} • Gerado em: ${today}`, 10, 14);

  // Stats line
  const totalRevenue = items.reduce((s, i) => s + i.totalRevenue, 0);
  const totalQty = items.reduce((s, i) => s + i.quantitySold, 0);
  const countA = items.filter(i => i.classification === 'A').length;
  const countB = items.filter(i => i.classification === 'B').length;
  const countC = items.filter(i => i.classification === 'C').length;
  doc.setFontSize(8);
  doc.text(
    `Faturamento: ${fmtMoney(totalRevenue)}  |  Itens: ${totalQty}  |  A: ${countA}  B: ${countB}  C: ${countC}`,
    10,
    18,
  );

  // Compact chart (smaller, max ~60mm tall)
  const chartImg = await captureElement('[data-abc-chart]');
  let nextY = 22;
  if (chartImg) {
    const props = doc.getImageProperties(chartImg);
    const maxW = doc.internal.pageSize.getWidth() - 20;
    const maxH = 55;
    const ratio = Math.min(maxW / props.width, maxH / props.height);
    const w = props.width * ratio;
    const h = props.height * ratio;
    doc.addImage(chartImg, 'PNG', 10, nextY, w, h);
    nextY += h + 3;
  }

  // Dense table (no variations page)
  autoTable(doc, {
    startY: nextY,
    head: [['#', 'Produto', 'Qtd', 'Faturamento', '% Indiv.', '% Acum.', 'Cl.']],
    body: items.map(i => [
      i.rank,
      i.productName,
      i.quantitySold,
      fmtMoney(i.totalRevenue),
      `${i.individualPercent.toFixed(1)}%`,
      `${i.accumulatedPercent.toFixed(1)}%`,
      i.classification,
    ]),
    styles: { fontSize: 7, cellPadding: 1, overflow: 'linebreak' },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 7.5 },
    margin: { left: 10, right: 10 },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 16, halign: 'right' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 20, halign: 'right' },
      6: { cellWidth: 12, halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 6) {
        const v = data.cell.raw;
        if (v === 'A') data.cell.styles.fillColor = [220, 252, 231];
        if (v === 'B') data.cell.styles.fillColor = [254, 249, 195];
        if (v === 'C') data.cell.styles.fillColor = [254, 226, 226];
      }
    },
  });

  doc.save(`curva-abc_${periodLabel}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export async function exportClassificationToPDF(
  products: ClassifiedProduct[],
  periodLabel: string,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const today = new Date().toLocaleDateString('pt-BR');

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Classificação Estratégica de Produtos', 10, 10);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Período: ${periodLabel} • Gerado em: ${today}`, 10, 14);

  // Compact summary line per class
  const groups: Record<string, ClassifiedProduct[]> = {
    CORE: [],
    SUPORTE: [],
    ENTRADA: [],
    CONTROLADO: [],
  };
  for (const p of products) {
    if (groups[p.classification]) groups[p.classification].push(p);
  }
  const summary = Object.entries(groups)
    .map(([cls, list]) => `${cls}: ${list.length}`)
    .join('  |  ');
  doc.text(`Total: ${products.length}  |  ${summary}`, 10, 18);

  const classColors: Record<string, [number, number, number]> = {
    CORE: [220, 252, 231],
    SUPORTE: [219, 234, 254],
    ENTRADA: [254, 249, 195],
    CONTROLADO: [254, 226, 226],
  };

  // Single dense combined table with classification column
  const sorted = [...products].sort((a, b) => {
    const order = ['CORE', 'SUPORTE', 'ENTRADA', 'CONTROLADO'];
    const d = order.indexOf(a.classification) - order.indexOf(b.classification);
    if (d !== 0) return d;
    return b.totalProfit - a.totalProfit;
  });

  autoTable(doc, {
    startY: 22,
    head: [['Classe', 'Produto', 'P. Médio', 'Custo', 'Lucro/Un', 'Margem', 'Qtd', 'Lucro Total']],
    body: sorted.map(p => [
      p.classification,
      p.name,
      fmtMoney(p.avgPrice),
      fmtMoney(p.totalCostPerUnit),
      fmtMoney(p.profitPerUnit),
      `${p.marginPercent.toFixed(1)}%`,
      p.qtySold,
      fmtMoney(p.totalProfit),
    ]),
    styles: { fontSize: 7, cellPadding: 1, overflow: 'linebreak' },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 7.5 },
    margin: { left: 10, right: 10 },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 24, halign: 'right' },
      3: { cellWidth: 24, halign: 'right' },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 18, halign: 'right' },
      6: { cellWidth: 14, halign: 'right' },
      7: { cellWidth: 28, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        const color = classColors[String(data.cell.raw)];
        if (color) data.cell.styles.fillColor = color;
      }
    },
  });

  doc.save(`classificacao-estrategica_${periodLabel}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
