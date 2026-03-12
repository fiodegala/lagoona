import { useState, useRef, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Upload, FileText, AlertCircle, CheckCircle2, Download, Loader2,
  Users, ShoppingCart, Receipt, Database,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

type ImportType = 'customers' | 'sales' | 'orders';

interface ParsedRecord {
  data: Record<string, string>;
  errors: string[];
  isValid: boolean;
}

const BATCH_SIZE = 100;

const TEMPLATES: Record<ImportType, { headers: string; example: string; filename: string }> = {
  customers: {
    headers: 'nome;email;telefone;documento;tipo;endereco;cidade;estado;cep;bairro;observacoes',
    example: 'Maria Silva;maria@email.com;11999998888;123.456.789-00;fisica;Rua A, 100;São Paulo;SP;01000-000;Centro;Cliente VIP',
    filename: 'modelo_importacao_clientes.csv',
  },
  sales: {
    headers: 'data;cliente;cpf_cliente;valor;desconto;valor_total;forma_pagamento;tipo_venda;observacoes',
    example: '2024-01-15;Maria Silva;123.456.789-00;150.00;10.00;140.00;cartao_credito;varejo;Venda importada',
    filename: 'modelo_importacao_vendas.csv',
  },
  orders: {
    headers: 'data;cliente;email;valor_total;status;forma_pagamento;status_pagamento;observacoes;id_externo',
    example: '2024-01-15;Maria Silva;maria@email.com;299.90;delivered;pix;paid;Pedido importado;ORD-001',
    filename: 'modelo_importacao_pedidos.csv',
  },
};

const TYPE_LABELS: Record<ImportType, { label: string; icon: typeof Users; description: string }> = {
  customers: { label: 'Clientes', icon: Users, description: 'Importar base de clientes' },
  sales: { label: 'Vendas (PDV)', icon: Receipt, description: 'Importar histórico de vendas' },
  orders: { label: 'Pedidos Online', icon: ShoppingCart, description: 'Importar pedidos do e-commerce' },
};

const REQUIRED_FIELDS: Record<ImportType, string[]> = {
  customers: ['nome'],
  sales: ['valor_total'],
  orders: ['email', 'valor_total'],
};

const DataImport = () => {
  const [activeTab, setActiveTab] = useState<ImportType>('customers');
  const [parsedRecords, setParsedRecords] = useState<ParsedRecord[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ inserted: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setParsedRecords([]);
    setFileName(null);
    setProgress(0);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const parseCSV = useCallback((content: string, type: ImportType): ParsedRecord[] => {
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) {
      toast.error('Arquivo deve ter cabeçalho e ao menos uma linha de dados');
      return [];
    }

    const sep = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/["']/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''));

    const results: ParsedRecord[] = [];
    const required = REQUIRED_FIELDS[type];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      for (const char of line) {
        if (char === '"') { inQuotes = !inQuotes; }
        else if (char === sep && !inQuotes) { values.push(current.trim().replace(/^["']|["']$/g, '')); current = ''; }
        else { current += char; }
      }
      values.push(current.trim().replace(/^["']|["']$/g, ''));

      const data: Record<string, string> = {};
      headers.forEach((h, idx) => { data[h] = values[idx] || ''; });

      const errors: string[] = [];
      for (const field of required) {
        const normalField = field.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (!data[normalField] || data[normalField].trim() === '') {
          errors.push(`Campo "${field}" obrigatório`);
        }
      }

      // Validate specific fields
      if (type === 'sales' || type === 'orders') {
        const val = data['valor_total'] || data['valor'] || data['total'];
        if (val) {
          const parsed = parseFloat(val.replace(/[R$\s]/g, '').replace(',', '.'));
          if (isNaN(parsed) || parsed < 0) errors.push('Valor inválido');
        }
      }

      if (type === 'orders' && data['email']) {
        if (!data['email'].includes('@')) errors.push('Email inválido');
      }

      results.push({ data, errors, isValid: errors.length === 0 });
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
      const records = parseCSV(content, activeTab);
      setParsedRecords(records);
      if (records.length > 0) {
        const valid = records.filter(r => r.isValid).length;
        toast.info(`${records.length} registros encontrados, ${valid} válidos`);
      }
    };
    reader.onerror = () => toast.error('Erro ao ler arquivo');
    reader.readAsText(file, 'UTF-8');
  };

  const mapRecordToPayload = (record: Record<string, string>, type: ImportType) => {
    const cleanNum = (v: string) => parseFloat((v || '0').replace(/[R$\s]/g, '').replace(',', '.')) || 0;

    if (type === 'customers') {
      return {
        nome: record.nome || record.name,
        email: record.email,
        telefone: record.telefone || record.phone,
        documento: record.documento || record.cpf || record.cnpj || record.document,
        tipo: record.tipo || record.type || 'fisica',
        endereco: record.endereco || record.address,
        cidade: record.cidade || record.city,
        estado: record.estado || record.state,
        cep: record.cep || record.zip_code,
        bairro: record.bairro || record.neighborhood,
        observacoes: record.observacoes || record.notes,
      };
    }

    if (type === 'sales') {
      return {
        data: record.data || record.date || record.created_at,
        cliente: record.cliente || record.customer_name || record.customer,
        cpf_cliente: record.cpf_cliente || record.documento || record.document,
        valor: cleanNum(record.valor || record.subtotal || record.valor_total),
        desconto: cleanNum(record.desconto || record.discount),
        valor_total: cleanNum(record.valor_total || record.total || record.valor),
        forma_pagamento: record.forma_pagamento || record.payment_method || 'dinheiro',
        tipo_venda: record.tipo_venda || record.sale_type || 'varejo',
        observacoes: record.observacoes || record.notes,
        itens: [],
      };
    }

    // orders
    return {
      data: record.data || record.date || record.created_at,
      cliente: record.cliente || record.customer_name || record.customer,
      email: record.email || record.customer_email,
      valor_total: cleanNum(record.valor_total || record.total),
      status: record.status || 'delivered',
      forma_pagamento: record.forma_pagamento || record.payment_method,
      status_pagamento: record.status_pagamento || record.payment_status || 'paid',
      observacoes: record.observacoes || record.notes,
      id_externo: record.id_externo || record.external_id,
      itens: [],
    };
  };

  const handleImport = async () => {
    const validRecords = parsedRecords.filter(r => r.isValid);
    if (validRecords.length === 0) {
      toast.error('Nenhum registro válido para importar');
      return;
    }

    setIsImporting(true);
    setProgress(0);
    setImportResult(null);

    const allPayloads = validRecords.map(r => mapRecordToPayload(r.data, activeTab));
    const totalBatches = Math.ceil(allPayloads.length / BATCH_SIZE);
    let totalInserted = 0;
    const allErrors: string[] = [];

    for (let i = 0; i < totalBatches; i++) {
      const batch = allPayloads.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);

      try {
        const { data, error } = await supabase.functions.invoke('import-data', {
          body: {
            type: activeTab,
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
      toast.success(`${totalInserted} registros importados com sucesso!`);
    } else if (totalInserted > 0) {
      toast.warning(`${totalInserted} importados, ${allErrors.length} erro(s)`);
    } else {
      toast.error('Falha na importação');
    }
  };

  const downloadTemplate = (type: ImportType) => {
    const tpl = TEMPLATES[type];
    const content = `${tpl.headers}\n${tpl.example}`;
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = tpl.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Modelo CSV baixado');
  };

  const validCount = parsedRecords.filter(r => r.isValid).length;
  const invalidCount = parsedRecords.filter(r => !r.isValid).length;
  const previewHeaders = parsedRecords.length > 0 ? Object.keys(parsedRecords[0].data).slice(0, 6) : [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Database className="h-6 w-6" />
            Importar Dados
          </h1>
          <p className="text-muted-foreground mt-1">
            Importe dados do seu BI ou sistema anterior via arquivos CSV
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as ImportType); resetState(); }}>
          <TabsList className="grid w-full grid-cols-3">
            {(Object.entries(TYPE_LABELS) as [ImportType, typeof TYPE_LABELS[ImportType]][]).map(([key, val]) => (
              <TabsTrigger key={key} value={key} className="gap-2">
                <val.icon className="h-4 w-4" />
                {val.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {(Object.keys(TYPE_LABELS) as ImportType[]).map((type) => (
            <TabsContent key={type} value={type}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Importar {TYPE_LABELS[type].label}
                  </CardTitle>
                  <CardDescription>{TYPE_LABELS[type].description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Import result */}
                  {importResult && (
                    <Alert variant={importResult.errors.length === 0 ? 'default' : 'destructive'}>
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertDescription>
                        <strong>{importResult.inserted}</strong> registros importados com sucesso.
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

                  {/* Progress bar */}
                  {isImporting && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Importando...</span>
                        <span className="font-medium">{progress}%</span>
                      </div>
                      <Progress value={progress} />
                    </div>
                  )}

                  {parsedRecords.length === 0 && !importResult ? (
                    <div className="space-y-4">
                      <div
                        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-lg font-medium mb-2">
                          Clique para selecionar um arquivo CSV
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Suporta arquivos com separador vírgula (,) ou ponto e vírgula (;)
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
                          <strong>Campos obrigatórios:</strong> {REQUIRED_FIELDS[type].join(', ')}
                          <br />
                          <strong>Dica:</strong> Baixe o modelo CSV para ver o formato esperado. O sistema aceita nomes de coluna em português ou inglês.
                        </AlertDescription>
                      </Alert>

                      <Button variant="outline" className="gap-2" onClick={() => downloadTemplate(type)}>
                        <Download className="h-4 w-4" />
                        Baixar modelo CSV de {TYPE_LABELS[type].label}
                      </Button>
                    </div>
                  ) : parsedRecords.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <Badge variant="outline" className="gap-1">
                            <FileText className="h-3 w-3" />
                            {fileName}
                          </Badge>
                          <Badge className="bg-green-500/10 text-green-600 gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            {validCount} válido(s)
                          </Badge>
                          {invalidCount > 0 && (
                            <Badge variant="destructive" className="gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {invalidCount} com erro(s)
                            </Badge>
                          )}
                          <Badge variant="secondary">
                            Total: {parsedRecords.length} registros
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
                              <TableHead className="w-[50px]">Status</TableHead>
                              {previewHeaders.map(h => (
                                <TableHead key={h} className="capitalize">{h}</TableHead>
                              ))}
                              <TableHead>Erros</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {parsedRecords.slice(0, 100).map((record, idx) => (
                              <TableRow key={idx} className={!record.isValid ? 'bg-destructive/5' : ''}>
                                <TableCell>
                                  {record.isValid ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                  )}
                                </TableCell>
                                {previewHeaders.map(h => (
                                  <TableCell key={h} className="max-w-[200px] truncate">
                                    {record.data[h] || '—'}
                                  </TableCell>
                                ))}
                                <TableCell>
                                  {record.errors.length > 0 ? (
                                    <span className="text-sm text-destructive">{record.errors.join(', ')}</span>
                                  ) : (
                                    <span className="text-green-500 text-sm">OK</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>

                      {parsedRecords.length > 100 && (
                        <p className="text-sm text-muted-foreground text-center">
                          Exibindo 100 de {parsedRecords.length} registros
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
                              Importar {validCount} {TYPE_LABELS[type].label.toLowerCase()}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default DataImport;
