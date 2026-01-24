import { useState, useEffect } from 'react';
import { Ruler, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { measurementTablesService, MeasurementTable } from '@/services/measurementTables';

interface SizeGuideModalProps {
  categoryId: string | null;
}

const SizeGuideModal = ({ categoryId }: SizeGuideModalProps) => {
  const [measurementTable, setMeasurementTable] = useState<MeasurementTable | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const loadMeasurementTable = async () => {
      if (!categoryId || !isOpen) return;

      try {
        setIsLoading(true);
        const table = await measurementTablesService.getByCategory(categoryId);
        setMeasurementTable(table);
      } catch (error) {
        console.error('Error loading measurement table:', error);
        setMeasurementTable(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadMeasurementTable();
  }, [categoryId, isOpen]);

  if (!categoryId) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Ruler className="h-4 w-4" />
          Guia de Tamanhos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ruler className="h-5 w-5 text-store-primary" />
            Guia de Tamanhos
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : measurementTable && measurementTable.columns.length > 0 && measurementTable.rows.length > 0 ? (
          <div className="space-y-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold bg-muted">Tamanho</TableHead>
                    {measurementTable.columns.map((col) => (
                      <TableHead key={col.name} className="text-center bg-muted">
                        {col.name}
                        {col.unit && (
                          <span className="text-muted-foreground font-normal ml-1">
                            ({col.unit})
                          </span>
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {measurementTable.rows.map((row) => (
                    <TableRow key={row.size}>
                      <TableCell className="font-medium">{row.size}</TableCell>
                      {measurementTable.columns.map((col) => (
                        <TableCell key={col.name} className="text-center">
                          {row.values[col.name] || '—'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-semibold text-sm">Como medir</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-store-primary">1.</span>
                  <span>Use uma fita métrica flexível para medições mais precisas.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-store-primary">2.</span>
                  <span>Mantenha a fita rente ao corpo, sem apertar.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-store-primary">3.</span>
                  <span>Em caso de dúvida entre dois tamanhos, opte pelo maior.</span>
                </li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Ruler className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Guia de tamanhos não disponível para esta categoria.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SizeGuideModal;
