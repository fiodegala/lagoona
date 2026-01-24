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

  // New column form
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnUnit, setNewColumnUnit] = useState('cm');

  // New row form
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
    if (!newColumnName.trim()) {
      toast.error('Nome da coluna é obrigatório');
      return;
    }

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
    
    // Add empty value for this column in all existing rows
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
    
    // Remove this column value from all rows
    setRows(
      rows.map((row) => {
        const newValues = { ...row.values };
        delete newValues[columnName];
        return { ...row, values: newValues };
      })
    );
  };

  const handleAddRow = () => {
    if (!newRowSize.trim()) {
      toast.error('Tamanho é obrigatório');
      return;
    }

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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
          <div className="space-y-6">
            {/* Table Name */}
            <div className="space-y-2">
              <Label>Nome da Tabela</Label>
              <Input
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="Tabela de Medidas"
              />
            </div>

            {/* Columns Management */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Colunas (Medidas)</Label>
              
              <div className="flex flex-wrap gap-2">
                {columns.map((col) => (
                  <div
                    key={col.name}
                    className="flex items-center gap-1 bg-secondary px-3 py-1 rounded-md"
                  >
                    <span className="text-sm">
                      {col.name}
                      {col.unit && (
                        <span className="text-muted-foreground ml-1">({col.unit})</span>
                      )}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 hover:bg-transparent"
                      onClick={() => handleRemoveColumn(col.name)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Nome</Label>
                  <Input
                    placeholder="Ex: Largura, Busto, Comprimento..."
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()}
                  />
                </div>
                <div className="w-24">
                  <Label className="text-xs text-muted-foreground">Unidade</Label>
                  <Input
                    placeholder="cm"
                    value={newColumnUnit}
                    onChange={(e) => setNewColumnUnit(e.target.value)}
                  />
                </div>
                <Button onClick={handleAddColumn} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Rows (Sizes) */}
            {columns.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Tamanhos e Valores</Label>

                <div className="flex gap-2 items-end mb-4">
                  <div className="w-32">
                    <Label className="text-xs text-muted-foreground">Novo Tamanho</Label>
                    <Input
                      placeholder="Ex: P, M, G, 38, 40..."
                      value={newRowSize}
                      onChange={(e) => setNewRowSize(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddRow()}
                    />
                  </div>
                  <Button onClick={handleAddRow} size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar Tamanho
                  </Button>
                </div>

                {rows.length > 0 ? (
                  <div className="border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24">Tamanho</TableHead>
                          {columns.map((col) => (
                            <TableHead key={col.name}>
                              {col.name}
                              {col.unit && (
                                <span className="text-muted-foreground font-normal ml-1">
                                  ({col.unit})
                                </span>
                              )}
                            </TableHead>
                          ))}
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row) => (
                          <TableRow key={row.size}>
                            <TableCell className="font-medium">{row.size}</TableCell>
                            {columns.map((col) => (
                              <TableCell key={col.name}>
                                <Input
                                  value={row.values[col.name] || ''}
                                  onChange={(e) =>
                                    handleCellChange(row.size, col.name, e.target.value)
                                  }
                                  placeholder="-"
                                  className="h-8 w-20"
                                />
                              </TableCell>
                            ))}
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleRemoveRow(row.size)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                    Adicione tamanhos para preencher a tabela
                  </p>
                )}
              </div>
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
