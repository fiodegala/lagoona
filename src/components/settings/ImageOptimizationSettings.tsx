import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ImageDown, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const BATCH = 4;
const MAX_RETRIES = 2;

type Totals = { products: number; variations: number; images: number; batches: number };

const ImageOptimizationSettings = () => {
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [totals, setTotals] = useState<Totals>({ products: 0, variations: 0, images: 0, batches: 0 });

  const run = async () => {
    setRunning(true);
    setLog([]);
    setTotals({ products: 0, variations: 0, images: 0, batches: 0 });

    let offset = 0;
    const acc: Totals = { products: 0, variations: 0, images: 0, batches: 0 };

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let data: any = null;
        let lastErr: any = null;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          const res = await supabase.functions.invoke('optimize-product-images', {
            body: { limit: BATCH, offset },
          });
          if (!res.error) {
            data = res.data;
            lastErr = null;
            break;
          }
          lastErr = res.error;
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        }

        if (lastErr || !data) {
          setLog((l) => [
            ...l,
            `Lote no offset ${offset} falhou (${lastErr?.message || 'erro'}). Pulando para o próximo.`,
          ]);
          offset += BATCH;
          if (offset > 5000) break;
          continue;
        }

        const productsDone = Number(data?.productsUpdated ?? 0);
        const variationsDone = Number(data?.variationsUpdated ?? 0);
        const imagesDone = Number(data?.imagesConverted ?? 0);

        acc.products += productsDone;
        acc.variations += variationsDone;
        acc.images += imagesDone;
        acc.batches += 1;
        setTotals({ ...acc });
        setLog((l) => [
          ...l,
          `Lote ${acc.batches} (offset ${offset}): ${imagesDone} imagens otimizadas, ${productsDone} produtos, ${variationsDone} variações.`,
        ]);

        if (data?.done || data?.nextOffset == null) break;
        offset = Number(data.nextOffset);
        if (offset > 5000) break;
      }


      toast.success(`Otimização concluída: ${acc.images} imagens convertidas para WebP.`);
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao otimizar imagens');
      setLog((l) => [...l, `Erro: ${e?.message || e}`]);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageDown className="h-5 w-5" />
          Otimização de imagens
        </CardTitle>
        <CardDescription>
          Converte as fotos já cadastradas para WebP (máx. 1200px, qualidade 80%) mantendo a proporção original e
          atualiza os links de produtos e variações.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={run} disabled={running}>
          {running ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Otimizando...
            </>
          ) : (
            'Otimizar imagens existentes'
          )}
        </Button>

        {running && <Progress value={undefined} className="h-2" />}

        {totals.batches > 0 && (
          <div className="text-sm text-muted-foreground">
            {totals.images} imagens otimizadas · {totals.products} produtos · {totals.variations} variações
          </div>
        )}

        {log.length > 0 && (
          <div className="max-h-48 overflow-auto rounded-md border p-3 text-xs text-muted-foreground space-y-1">
            {log.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ImageOptimizationSettings;
