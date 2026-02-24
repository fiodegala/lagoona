import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Trash2, Loader2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  measurementTablesService,
  MeasurementTable,
  MeasurementColumn,
  MeasurementRow,
} from '@/services/measurementTables';

interface MeasurementTableEditorProps {
  open: boolean;
  onClose: () => void;
  categoryId: string;
  categoryName: string;
}

const MeasurementTableEditor = ({
  open,
  onClose,
  categoryId,
  categoryName,
}: MeasurementTableEditorProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [existingTable, setExistingTable] = useState<MeasurementTable | null>(null);

  const [tableName, setTableName] = useState('Tabela de Medidas');
  const [columns, setColumns] = useState<MeasurementColumn[]>([]);
  const [rows, setRows] = useState<MeasurementRow[]>([]);

  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnUnit, setNewColumnUnit] = useState('cm');
  const [newRowSize, setNewRowSize] = useState('');

  useEffect(() => {
    if (open && categoryId) {
      loadData();
    }
  }, [open, categoryId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const table = await measurementTablesService.getByCategory(categoryId);

      if (table) {
        setExistingTable(table);
        setTableName(table.name);
        setColumns(table.columns);
        setRows(table.rows);
      } else {
        setExistingTable(null);
        setTableName('Tabela de Medidas');
        setColumns([]);
        setRows([]);
      }
    } catch (error) {
      console.error('Error loading measurement table:', error);
      toast.error('Erro ao carregar tabela de medidas');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddColumn = () => {
    if (!newColumnName.trim()) return;

    const exists = columns.some(
      (c) => c.name.toLowerCase() === newColumnName.trim().toLowerCase()
    );
    if (exists) {
      toast.error('Coluna já existe');
      return;
    }

    const newColumn: MeasurementColumn = {
      name: newColumnName.trim(),
      unit: newColumnUnit.trim() || undefined,
    };

    setColumns([...columns, newColumn]);
    setRows(
      rows.map((row) => ({
        ...row,
        values: { ...row.values, [newColumn.name]: '' },
      }))
    );
    setNewColumnName('');
  };

  const handleRemoveColumn = (columnName: string) => {
    setColumns(columns.filter((c) => c.name !== columnName));
    setRows(
      rows.map((row) => {
        const newValues = { ...row.values };
        delete newValues[columnName];
        return { ...row, values: newValues };
      })
    );
  };

  const handleAddRow = () => {
    if (!newRowSize.trim()) return;

    const exists = rows.some(
      (r) => r.size.toLowerCase() === newRowSize.trim().toLowerCase()
    );
    if (exists) {
      toast.error('Tamanho já existe');
      return;
    }

    const newRow: MeasurementRow = {
      size: newRowSize.trim(),
      values: columns.reduce((acc, col) => ({ ...acc, [col.name]: '' }), {}),
    };

    setRows([...rows, newRow]);
    setNewRowSize('');
  };

  const handleRemoveRow = (size: string) => {
    setRows(rows.filter((r) => r.size !== size));
  };

  const handleCellChange = (size: string, columnName: string, value: string) => {
    setRows(
      rows.map((row) =>
        row.size === size
          ? { ...row, values: { ...row.values, [columnName]: value } }
          : row
      )
    );
  };

  const handleSave = async () => {
    if (columns.length === 0) {
      toast.error('Adicione pelo menos uma coluna');
      return;
    }

    setIsSaving(true);
    try {
      if (existingTable) {
        await measurementTablesService.update(existingTable.id, {
          name: tableName,
          columns,
          rows,
        });
        toast.success('Tabela de medidas atualizada!');
      } else {
        const created = await measurementTablesService.create({
          category_id: categoryId,
          name: tableName,
          columns,
          rows,
        });
        setExistingTable(created);
        toast.success('Tabela de medidas criada!');
      }
    } catch (error) {
      console.error('Error saving measurement table:', error);
      toast.error('Erro ao salvar tabela de medidas');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingTable) return;

    setIsSaving(true);
    try {
      await measurementTablesService.delete(existingTable.id);
      toast.success('Tabela de medidas removida!');
      onClose();
    } catch (error) {
      console.error('Error deleting measurement table:', error);
      toast.error('Erro ao remover tabela de medidas');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Tabela de Medidas - {categoryName}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Table Name */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nome da Tabela</Label>
              <Input
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="Tabela de Medidas"
                className="max-w-xs"
              />
            </div>

            {/* Full spreadsheet-style table */}
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-28 font-semibold border-r">Tamanho</TableHead>
                    {columns.map((col) => (
                      <TableHead key={col.name} className="text-center border-r min-w-[100px]">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-xs font-semibold">
                            {col.name}
                            {col.unit && (
                              <span className="text-muted-foreground font-normal ml-1">
                                ({col.unit})
                              </span>
                            )}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 hover:bg-destructive/10 shrink-0"
                            onClick={() => handleRemoveColumn(col.name)}
                          >
                            <X className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </TableHead>
                    ))}
                    {/* Add column header */}
                    <TableHead className="min-w-[180px]">
                      <div className="flex items-center gap-1">
                        <Input
                          placeholder="Medida"
                          value={newColumnName}
                          onChange={(e) => setNewColumnName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()}
                          className="h-7 text-xs"
                        />
                        <Input
                          placeholder="un."
                          value={newColumnUnit}
                          onChange={(e) => setNewColumnUnit(e.target.value)}
                          className="h-7 text-xs w-14"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={handleAddColumn}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.size}>
                      <TableCell className="font-medium border-r bg-muted/30">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-sm">{row.size}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:bg-destructive/10 shrink-0"
                            onClick={() => handleRemoveRow(row.size)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                      {columns.map((col) => (
                        <TableCell key={col.name} className="p-1 border-r">
                          <Input
                            value={row.values[col.name] || ''}
                            onChange={(e) =>
                              handleCellChange(row.size, col.name, e.target.value)
                            }
                            placeholder="—"
                            className="h-8 text-center border-0 bg-transparent focus-visible:ring-1 focus-visible:ring-primary"
                          />
                        </TableCell>
                      ))}
                      <TableCell />
                    </TableRow>
                  ))}

                  {/* Add row inline */}
                  <TableRow className="bg-muted/20">
                    <TableCell className="border-r p-1">
                      <div className="flex items-center gap-1">
                        <Input
                          placeholder="Novo tamanho (P, M, 38...)"
                          value={newRowSize}
                          onChange={(e) => setNewRowSize(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddRow()}
                          className="h-8 text-xs"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={handleAddRow}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                    {columns.map((col) => (
                      <TableCell key={col.name} className="border-r p-1" />
                    ))}
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {columns.length === 0 && rows.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Comece adicionando colunas (medidas) no cabeçalho da tabela e tamanhos nas linhas.
              </p>
            )}

            {/* Actions */}
            <div className="flex justify-between pt-4 border-t">
              <div>
                {existingTable && (
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isSaving}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir Tabela
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MeasurementTableEditor;
