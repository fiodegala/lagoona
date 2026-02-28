import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { FolderTree, Plus, Pencil, Trash2, Loader2, Eye, EyeOff, Ruler, GripVertical, Grid3X3, LayoutList } from 'lucide-react';
import { toast } from 'sonner';
import { categoriesService, Category } from '@/services/categories';
import CategoryFormModal from '@/components/CategoryFormModal';
import MeasurementTableEditor from '@/components/MeasurementTableEditor';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

interface SortableCategoryRowProps {
  category: Category;
  getParentName: (parentId: string | null) => string | null;
  onEdit: (category: Category) => void;
  onDelete: (id: string) => void;
  onToggleActive: (category: Category) => void;
  onMeasurement: (category: Category) => void;
}

const SortableCategoryRow = ({
  category,
  getParentName,
  onEdit,
  onDelete,
  onToggleActive,
  onMeasurement,
}: SortableCategoryRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && 'opacity-50 bg-muted')}
    >
      <TableCell className="w-10">
        <button
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
            {category.image_url ? (
              <img
                src={category.image_url}
                alt={category.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <FolderTree className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="font-medium">{category.name}</p>
            {category.description && (
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                {category.description}
              </p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <code className="text-sm bg-muted px-2 py-1 rounded">{category.slug}</code>
      </TableCell>
      <TableCell>
        {getParentName(category.parent_id) ? (
          <Badge variant="outline">{getParentName(category.parent_id)}</Badge>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </TableCell>
      <TableCell>
        {category.is_active ? (
          <Badge className="bg-success/10 text-success hover:bg-success/20">Ativa</Badge>
        ) : (
          <Badge variant="secondary">Inativa</Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onMeasurement(category)}
            title="Tabela de Medidas"
          >
            <Ruler className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onToggleActive(category)}
            title={category.is_active ? 'Desativar' : 'Ativar'}
          >
            {category.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEdit(category)}
            title="Editar"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                title="Excluir"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. A categoria "{category.name}" será removida
                  permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(category.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
};

const Categories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [measurementCategory, setMeasurementCategory] = useState<Category | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadCategories = async () => {
    try {
      const data = await categoriesService.getAll();
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast.error('Erro ao carregar categorias');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleCreate = () => {
    setEditingCategory(null);
    setFormOpen(true);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await categoriesService.delete(id);
      toast.success('Categoria excluída com sucesso');
      loadCategories();
    } catch (error: any) {
      if (error?.code === '23503') {
        toast.error('Não é possível excluir categoria com produtos ou subcategorias');
      } else {
        toast.error('Erro ao excluir categoria');
      }
    }
  };

  const handleToggleActive = async (category: Category) => {
    try {
      await categoriesService.toggleActive(category.id, !category.is_active);
      toast.success(category.is_active ? 'Categoria desativada' : 'Categoria ativada');
      loadCategories();
    } catch (error) {
      toast.error('Erro ao atualizar categoria');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = categories.findIndex((c) => c.id === active.id);
      const newIndex = categories.findIndex((c) => c.id === over.id);

      const newOrder = arrayMove(categories, oldIndex, newIndex);
      setCategories(newOrder);

      try {
        await categoriesService.reorder(newOrder.map((c) => c.id));
        toast.success('Ordem das categorias atualizada');
      } catch (error) {
        console.error('Error reordering categories:', error);
        toast.error('Erro ao reordenar categorias');
        loadCategories();
      }
    }
  };

  const getParentName = (parentId: string | null) => {
    if (!parentId) return null;
    const parent = categories.find((c) => c.id === parentId);
    return parent?.name || null;
  };

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Categorias</h1>
            <p className="text-muted-foreground mt-1">
              Organize seus produtos em categorias. Arraste para reordenar.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border rounded-lg overflow-hidden">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('list')}
                className="rounded-none h-9 w-9"
              >
                <LayoutList className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('grid')}
                className="rounded-none h-9 w-9"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
            </div>
            <Button className="gap-2" onClick={handleCreate}>
              <Plus className="h-4 w-4" />
              Nova Categoria
            </Button>
          </div>
        </div>

        <Card className="card-elevated">
          {isLoading ? (
            <CardContent className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          ) : categories.length === 0 ? (
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FolderTree className="h-12 w-12 text-muted-foreground mb-4" />
              <CardTitle className="text-lg mb-2">Nenhuma categoria cadastrada</CardTitle>
              <CardDescription className="text-center mb-4">
                Comece adicionando sua primeira categoria
              </CardDescription>
              <Button className="gap-2" onClick={handleCreate}>
                <Plus className="h-4 w-4" />
                Adicionar Categoria
              </Button>
            </CardContent>
          ) : (
            <CardContent className={viewMode === 'list' ? 'p-0' : 'p-4'}>
              {viewMode === 'list' ? (
                <div className="overflow-x-auto">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Slug</TableHead>
                          <TableHead>Categoria Pai</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <SortableContext
                          items={categories.map((c) => c.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {categories.map((category) => (
                            <SortableCategoryRow
                              key={category.id}
                              category={category}
                              getParentName={getParentName}
                              onEdit={handleEdit}
                              onDelete={handleDelete}
                              onToggleActive={handleToggleActive}
                              onMeasurement={setMeasurementCategory}
                            />
                          ))}
                        </SortableContext>
                      </TableBody>
                    </Table>
                  </DndContext>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {categories.map((category) => (
                    <div
                      key={category.id}
                      className="group relative rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow"
                    >
                      <div className="aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden">
                        {category.image_url ? (
                          <img
                            src={category.image_url}
                            alt={category.name}
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <FolderTree className="h-10 w-10 text-muted-foreground/40" />
                        )}
                      </div>
                      <div className="p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-sm truncate">{category.name}</p>
                          {category.is_active ? (
                            <Badge className="bg-success/10 text-success hover:bg-success/20 text-xs shrink-0">Ativa</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs shrink-0">Inativa</Badge>
                          )}
                        </div>
                        {category.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{category.description}</p>
                        )}
                        {getParentName(category.parent_id) && (
                          <Badge variant="outline" className="text-xs">{getParentName(category.parent_id)}</Badge>
                        )}
                        <div className="flex items-center justify-end gap-1 pt-1 border-t">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMeasurementCategory(category)} title="Tabela de Medidas">
                            <Ruler className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleActive(category)} title={category.is_active ? 'Desativar' : 'Ativar'}>
                            {category.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(category)} title="Editar">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Excluir">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita. A categoria "{category.name}" será removida permanentemente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(category.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </div>

      <CategoryFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSuccess={loadCategories}
        category={editingCategory}
        categories={categories}
      />

      {measurementCategory && (
        <MeasurementTableEditor
          open={!!measurementCategory}
          onClose={() => setMeasurementCategory(null)}
          categoryId={measurementCategory.id}
          categoryName={measurementCategory.name}
        />
      )}
    </AdminLayout>
  );
};

export default Categories;
