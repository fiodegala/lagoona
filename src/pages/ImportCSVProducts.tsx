import { useState, useRef } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Upload, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const ImportCSVProducts = () => {
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ products: number; variations: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setResult(null);
    setError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setCsvContent(text);

      // Preview: count PRODUTO and VARIAÇÃO rows
      const lines = text.split('\n').filter(l => l.trim());
      let products = 0;
      let variations = 0;
      for (let i = 1; i < lines.length; i++) {
        const tipo = lines[i].split(',')[0]?.trim();
        if (tipo === 'PRODUTO') products++;
        else if (tipo === 'VARIAÇÃO') variations++;
      }
      setPreview({ products, variations });
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvContent) return;
    setIsImporting(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('import-csv-products', {
        body: { csvContent },
      });

      if (fnError) throw fnError;
      setResult(data);
    } catch (err: any) {
      console.error('Import error:', err);
      setError(err.message || 'Erro desconhecido');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Importar Produtos via CSV
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Selecione um arquivo CSV no formato com colunas <strong>tipo</strong> (PRODUTO/VARIAÇÃO),
              atributos em JSON, SKU, barcode e estoque por variação. O estoque será distribuído 50/50 entre as lojas físicas.
            </p>

            <div className="space-y-3">
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => fileRef.current?.click()}
              >
                <FileText className="h-4 w-4" />
                {fileName || 'Selecionar arquivo CSV'}
              </Button>

              {preview && (
                <Alert>
                  <FileText className="h-4 w-4" />
                  <AlertDescription>
                    Arquivo: <strong>{fileName}</strong>
                    <br />
                    Produtos encontrados: <strong>{preview.products}</strong>
                    <br />
                    Variações encontradas: <strong>{preview.variations}</strong>
                  </AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleImport}
                disabled={isImporting || !csvContent}
                className="w-full gap-2"
                size="lg"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importando... (pode demorar alguns minutos)
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Iniciar Importação
                  </>
                )}
              </Button>
            </div>

            {result && (
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  <strong>Importação concluída!</strong>
                  <br />
                  Produtos inseridos: {result.productsInserted}
                  <br />
                  Produtos com erro: {result.productsSkipped}
                  <br />
                  Variações inseridas: {result.variationsInserted}
                  <br />
                  Variações com erro: {result.variationsSkipped}
                  <br />
                  Registros de estoque: {result.stockInserted}
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default ImportCSVProducts;
