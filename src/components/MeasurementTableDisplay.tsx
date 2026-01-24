import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Ruler, Loader2 } from 'lucide-react';
import { measurementTablesService, MeasurementTable } from '@/services/measurementTables';

interface MeasurementTableDisplayProps {
  categoryId: string | null;
}

const MeasurementTableDisplay = ({ categoryId }: MeasurementTableDisplayProps) => {
  const [measurementTable, setMeasurementTable] = useState<MeasurementTable | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadMeasurementTable = async () => {
      if (!categoryId) {
        setMeasurementTable(null);
        setIsLoading(false);
        return;
      }

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
  }, [categoryId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!measurementTable || measurementTable.columns.length === 0 || measurementTable.rows.length === 0) {
    return null;
  }

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="measurement-table" className="border rounded-lg">
        <AccordionTrigger className="px-4 hover:no-underline">
          <div className="flex items-center gap-2">
            <Ruler className="h-4 w-4" />
            <span>{measurementTable.name}</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Tamanho</TableHead>
                  {measurementTable.columns.map((col) => (
                    <TableHead key={col.name} className="text-center">
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
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default MeasurementTableDisplay;
