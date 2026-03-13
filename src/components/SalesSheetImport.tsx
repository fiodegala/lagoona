import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Upload, FileText, AlertCircle, CheckCircle2, Loader2, FileSpreadsheet,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ParsedSaleRow {
  data: string;
  quantidade: number;
  valorUnitario: number;
  referencia: string;
  valorTotal: number;
  tipoPagamento: string;
  formaPagamento1: string;
  formaPagamento2: string;
  comoConheceu: string;
  vendedor: string;
  vendaPromocional: boolean;
  onlineOuPresencial: string;
  nomeLoja: string;
  nomeCliente: string;
  whatsapp: string;
  cidade: string;
  estado: string;
  modalidade: string;
  valorDesconto: number;
  quantidadeParcelas: string;
  isValid: boolean;
  errors: string[];
  lineNumber: number;
}

const BATCH_SIZE = 50;

const SalesSheetImport = () => {
  const [parsedRows, setParsedRows] = useState<ParsedSaleRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ inserted: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setParsedRows([]);
    setFileName(null);
    setProgress(0);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const cleanCurrency = (val: string): number => {
    if (!val || val.trim() === '') return 0;
    const cleaned = val.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const parseDate = (dateStr: string): string | null => {
    if (!dateStr || dateStr.trim() === '') return null;
    const parts = dateStr.trim().split('/');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts;
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T12:00:00`;
  };

  const mapPaymentMethod = (method: string, tipoPagamento: string): string => {
    if (tipoPagamento.toUpperCase().includes('DUAS')) return 'mixed';
    const m = method.trim().toUpperCase();
    if (m.includes('PIX')) return 'pix';
    if (m.includes('DINHEIRO')) return 'cash';
    // credit, debit, link, cheque all map to 'card'
    return 'card';
  };

  const mapSaleType = (modalidade: string): string => {
    const m = modalidade.trim().toUpperCase();
    if (m.includes('ATACADO')) return 'atacado';
    if (m.includes('ATACAREJO')) return 'atacarejo';
    return 'varejo';
  };

  const parseCSV = useCallback((content: string): ParsedSaleRow[] => {
    const lines = content.split('\n');
    if (lines.length < 3) {
      toast.error('Arquivo deve ter ao menos 3 linhas (título, cabeçalho e dados)');
      return [];
    }

    // Find header row - look for "DATA" in first column
    let headerIndex = -1;
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const firstCell = lines[i].split(',')[0].replace(/["']/g, '').trim().toUpperCase();
      if (firstCell === 'DATA') {
        headerIndex = i;
        break;
      }
    }

    if (headerIndex === -1) {
      toast.error('Cabeçalho "DATA" não encontrado nas primeiras linhas');
      return [];
    }

    const results: ParsedSaleRow[] = [];

    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV line handling quoted values
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      const dataVal = values[0]?.trim() || '';
      const quantidadeStr = values[1]?.trim() || '';
      const valorUnitarioStr = values[2]?.trim() || '';
      const referencia = values[3]?.trim() || '';
      const valorTotalStr = values[4]?.trim() || '';

      // Skip empty/separator rows
      if (!dataVal && !quantidadeStr && !valorTotalStr && !referencia) continue;
      if (!dataVal || !valorTotalStr) continue;

      const errors: string[] = [];

      const parsedDate = parseDate(dataVal);
      if (!parsedDate) errors.push('Data inválida');

      const quantidade = parseInt(quantidadeStr, 10);
      if (isNaN(quantidade) || quantidade <= 0) errors.push('Qtd inválida');

      const valorTotal = cleanCurrency(valorTotalStr);
      if (valorTotal <= 0) errors.push('Valor total inválido');

      const valorUnitario = cleanCurrency(valorUnitarioStr);

      const nomeCliente = values[13]?.trim() || '';
      if (!nomeCliente) errors.push('Cliente obrigatório');

      const formaPagamento1 = values[6]?.trim() || '';
      if (!formaPagamento1) errors.push('Forma de pagamento obrigatória');

      results.push({
        data: dataVal,
        quantidade: isNaN(quantidade) ? 0 : quantidade,
        valorUnitario,
        referencia,
        valorTotal,
        tipoPagamento: values[5]?.trim() || '',
        formaPagamento1,
        formaPagamento2: values[7]?.trim() || '',
        comoConheceu: values[8]?.trim() || '',
        vendedor: values[9]?.trim() || '',
        vendaPromocional: (values[10]?.trim() || '').toUpperCase() === 'SIM',
        onlineOuPresencial: values[11]?.trim() || '',
        nomeLoja: values[12]?.trim() || '',
        nomeCliente,
        whatsapp: values[14]?.trim() || '',
        cidade: values[15]?.trim() || '',
        estado: values[16]?.trim() || '',
        modalidade: values[17]?.trim() || '',
        valorDesconto: cleanCurrency(values[18] || ''),
        quantidadeParcelas: values[19]?.trim() || '',
        isValid: errors.length === 0,
        errors,
        lineNumber: i + 1,
      });
    }

    return results;
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      toast.error('Selecione um arquivo CSV');
      return;
    }

    setFileName(file.name);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      const rows = parseCSV(content);
      setParsedRows(rows);
      if (rows.length > 0) {
        const valid = rows.filter(r => r.isValid).length;
        toast.info(`${rows.length} linhas encontradas, ${valid} válidas`);
      }
    };
    reader.onerror = () => toast.error('Erro ao ler arquivo');
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      toast.error('Nenhum registro válido para importar');
      return;
    }

    setIsImporting(true);
    setProgress(0);
    setImportResult(null);

    // Map rows to pos_sales payloads
    const payloads = validRows.map(row => ({
      data: parseDate(row.data),
      cliente: row.nomeCliente,
      whatsapp: row.whatsapp,
      cidade: row.cidade,
      estado: row.estado,
      referencia: row.referencia,
      quantidade: row.quantidade,
      valor_unitario: row.valorUnitario,
      valor_total: row.valorTotal,
      forma_pagamento: mapPaymentMethod(row.formaPagamento1, row.tipoPagamento),
      forma_pagamento_original: row.formaPagamento1,
      forma_pagamento_2_original: row.formaPagamento2 || null,
      tipo_venda: mapSaleType(row.modalidade),
      vendedor: row.vendedor,
      como_conheceu: row.comoConheceu,
      nome_loja: row.nomeLoja,
      venda_promocional: row.vendaPromocional,
      online_ou_presencial: row.onlineOuPresencial,
      valor_desconto: row.valorDesconto,
      parcelas: row.quantidadeParcelas,
    }));

    const totalBatches = Math.ceil(payloads.length / BATCH_SIZE);
    let totalInserted = 0;
    const allErrors: string[] = [];

    for (let i = 0; i < totalBatches; i++) {
      const batch = payloads.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);

      try {
        const { data, error } = await supabase.functions.invoke('import-data', {
          body: {
            type: 'sales_sheet',
            records: batch,
            batch_index: i,
            total_batches: totalBatches,
          },
        });

        if (error) {
          allErrors.push(`Lote ${i + 1}: ${error.message}`);
        } else if (data) {
          totalInserted += data.inserted || 0;
          if (data.errors?.length) allErrors.push(...data.errors);
        }
      } catch (err: any) {
        allErrors.push(`Lote ${i + 1}: ${err.message}`);
      }

      setProgress(Math.round(((i + 1) / totalBatches) * 100));
    }

    setIsImporting(false);
    setImportResult({ inserted: totalInserted, errors: allErrors });

    if (allErrors.length === 0) {
      toast.success(`${totalInserted} vendas importadas com sucesso!`);
    } else if (totalInserted > 0) {
      toast.warning(`${totalInserted} importadas, ${allErrors.length} erro(s)`);
    } else {
      toast.error('Falha na importação');
    }
  };

  const validCount = parsedRows.filter(r => r.isValid).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;
  const totalValue = parsedRows.filter(r => r.isValid).reduce((sum, r) => sum + r.valorTotal, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Importar Vendas (Planilha Caixa)
        </CardTitle>
        <CardDescription>
          Importe vendas diretamente da planilha de caixa do Google Sheets
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {importResult && (
          <Alert variant={importResult.errors.length === 0 ? 'default' : 'destructive'}>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              <strong>{importResult.inserted}</strong> vendas importadas com sucesso.
              {importResult.errors.length > 0 && (
                <div className="mt-2 text-sm">
                  <strong>{importResult.errors.length} erro(s):</strong>
                  <ul className="list-disc pl-4 mt-1">
                    {importResult.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                    {importResult.errors.length > 5 && <li>...e mais {importResult.errors.length - 5}</li>}
                  </ul>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {isImporting && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Importando vendas...</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {parsedRows.length === 0 && !importResult ? (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">
                Clique para selecionar o CSV da planilha de caixa
              </p>
              <p className="text-sm text-muted-foreground">
                Formato: Google Sheets exportado como CSV
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Colunas esperadas:</strong> DATA, QUANTIDADE, VALOR UNITÁRIO, REFERÊNCIA, VALOR TOTAL, TIPO DE PAGAMENTO, 1° FORMA DE PAGAMENTO, 2° FORMA DE PAGAMENTO, COMO CONHECEU A LOJA, VENDEDOR, VENDA PROMOCIONAL, ONLINE OU PRESENCIAL, NOME DA LOJA, NOME DO CLIENTE, WHATSAPP, CIDADE, ESTADO, MODALIDADE, VALOR DO DESCONTO, QUANTIDADE PARCELAS
                <br /><br />
                <strong>Dica:</strong> No Google Sheets, vá em <em>Arquivo → Fazer download → CSV (.csv)</em>
              </AlertDescription>
            </Alert>
          </div>
        ) : parsedRows.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className="gap-1">
                  <FileText className="h-3 w-3" />
                  {fileName}
                </Badge>
                <Badge className="bg-success/10 text-success gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {validCount} válida(s)
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {invalidCount} com erro(s)
                  </Badge>
                )}
                <Badge variant="secondary">
                  Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue)}
                </Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={resetState}>
                Selecionar outro arquivo
              </Button>
            </div>

            <ScrollArea className="h-[350px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">OK</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Ref</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Modalidade</TableHead>
                    <TableHead>Erros</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.slice(0, 200).map((row, idx) => (
                    <TableRow key={idx} className={!row.isValid ? 'bg-destructive/5' : ''}>
                      <TableCell>
                        {row.isValid ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{row.data}</TableCell>
                      <TableCell className="max-w-[140px] truncate">{row.nomeCliente || '—'}</TableCell>
                      <TableCell>{row.referencia || '—'}</TableCell>
                      <TableCell>{row.quantidade}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.valorTotal)}
                      </TableCell>
                      <TableCell className="max-w-[100px] truncate">{row.formaPagamento1 || '—'}</TableCell>
                      <TableCell>{row.vendedor || '—'}</TableCell>
                      <TableCell>{row.modalidade || '—'}</TableCell>
                      <TableCell>
                        {row.errors.length > 0 ? (
                          <span className="text-sm text-destructive">{row.errors.join(', ')}</span>
                        ) : (
                          <span className="text-success text-sm">OK</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {parsedRows.length > 200 && (
              <p className="text-sm text-muted-foreground text-center">
                Exibindo 200 de {parsedRows.length} registros
              </p>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={resetState} disabled={isImporting}>
                Cancelar
              </Button>
              <Button
                onClick={handleImport}
                disabled={validCount === 0 || isImporting}
                className="gap-2"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importando... {progress}%
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Importar {validCount} venda(s)
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SalesSheetImport;
