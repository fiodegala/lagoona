import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Upload, X, Loader2, ImageIcon, GripVertical, Crop } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import ImageCropModal from './ImageCropModal';

interface MultiImageUploadProps {
  values: string[];
  onChange: (urls: string[]) => void;
  bucket: string;
  folder?: string;
  maxImages?: number;
}

const MultiImageUpload = ({ 
  values = [], 
  onChange, 
  bucket, 
  folder = '',
  maxImages = 20
}: MultiImageUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [cropIndex, setCropIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check max images limit
    const availableSlots = maxImages - values.length;
    if (availableSlots <= 0) {
      toast.error(`Limite de ${maxImages} imagens atingido`);
      return;
    }

    const filesToUpload = files.slice(0, availableSlots);
    if (filesToUpload.length < files.length) {
      toast.warning(`Apenas ${filesToUpload.length} de ${files.length} imagens serão enviadas (limite: ${maxImages})`);
    }

    // Validate file types
    const validFiles = filesToUpload.filter(file => {
      const isHeic = /\.(heic|heif)$/i.test(file.name) || /heic|heif/i.test(file.type);
      if (isHeic) {
        toast.error(`${file.name}: HEIC/HEIF não é suportado. Converta para JPG ou PNG.`);
        return false;
      }
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} não é uma imagem válida`);
        return false;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name} é muito grande (máx: 20MB)`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setIsUploading(true);
    setUploadingCount(validFiles.length);

    const uploadedUrls: string[] = [];

    for (const file of validFiles) {
      try {
        // Generate unique filename — preserve original extension
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
        const filePath = folder ? `${folder}/${fileName}` : fileName;

        // Upload to Supabase Storage with explicit content type
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type || 'image/jpeg',
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
      } catch (error: any) {
        console.error('Upload error:', error);
        const msg = error?.message || error?.error || 'Erro desconhecido';
        if (/row-level security|permission|unauthor/i.test(msg)) {
          toast.error(`${file.name}: sem permissão. Faça login novamente.`);
        } else if (/payload|too large|size/i.test(msg)) {
          toast.error(`${file.name}: imagem muito grande.`);
        } else if (/network|fetch|failed/i.test(msg)) {
          toast.error(`${file.name}: falha de conexão.`);
        } else {
          toast.error(`Erro ao enviar ${file.name}: ${msg}`);
        }
      }
    }

    if (uploadedUrls.length > 0) {
      onChange([...values, ...uploadedUrls]);
      toast.success(`${uploadedUrls.length} imagem(s) enviada(s) com sucesso!`);
    }

    setIsUploading(false);
    setUploadingCount(0);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleRemove = (index: number) => {
    const newValues = values.filter((_, i) => i !== index);
    onChange(newValues);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const newValues = [...values];
      const [removed] = newValues.splice(draggedIndex, 1);
      newValues.splice(dragOverIndex, 0, removed);
      onChange(newValues);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const canAddMore = values.length < maxImages;

  return (
    <div className="space-y-4">
      {/* Image Grid */}
      {values.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {values.map((url, index) => (
            <div
              key={`${url}-${index}`}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={cn(
                "relative group aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-move",
                draggedIndex === index && "opacity-50",
                dragOverIndex === index && "border-primary border-dashed",
                draggedIndex === null && "border-transparent hover:border-muted-foreground/30"
              )}
            >
              <img
                src={url}
                alt={`Galeria ${index + 1}`}
                className="w-full h-full object-cover"
              />
              
              {/* Order Badge */}
              <div className="absolute top-1 left-1 bg-background/80 backdrop-blur-sm text-xs font-medium px-1.5 py-0.5 rounded">
                {index + 1}
              </div>

              {/* Crop Button */}
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute top-1 right-14 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); setCropIndex(index); }}
              >
                <Crop className="h-3 w-3" />
              </Button>

              {/* Drag Handle */}
              <div className="absolute top-1 right-8 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm rounded p-0.5">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>

              {/* Remove Button */}
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRemove(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}

          {/* Add More Placeholder */}
          {canAddMore && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
              className={cn(
                "aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25",
                "flex flex-col items-center justify-center gap-1",
                "hover:border-muted-foreground/50 hover:bg-muted/50 transition-colors",
                "text-muted-foreground/50 hover:text-muted-foreground",
                isUploading && "pointer-events-none opacity-50"
              )}
            >
              <ImageIcon className="h-6 w-6" />
              <span className="text-xs">Adicionar</span>
            </button>
          )}
        </div>
      )}

      {/* Empty State */}
      {values.length === 0 && (
        <div 
          className={cn(
            "flex flex-col items-center justify-center h-32 rounded-lg",
            "border-2 border-dashed border-muted-foreground/25 bg-muted/50",
            "text-muted-foreground/50"
          )}
        >
          <ImageIcon className="h-10 w-10 mb-2" />
          <span className="text-sm">Nenhuma imagem adicionada</span>
          <span className="text-xs mt-1">Arraste para reordenar após adicionar</span>
        </div>
      )}

      {/* Upload Button & Counter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
            id="multi-image-upload"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading || !canAddMore}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando {uploadingCount}...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Adicionar imagens
              </>
            )}
          </Button>

        </div>
        
        <span className="text-xs text-muted-foreground">
          {values.length} / {maxImages} imagens
        </span>
      </div>

      {values.length > 1 && (
        <p className="text-xs text-muted-foreground">
          💡 Arraste as imagens para reordená-las. A primeira será a imagem principal. Clique no ícone ✂️ para ajustar.
        </p>
      )}

      {cropIndex !== null && values[cropIndex] && (
        <ImageCropModal
          open={true}
          imageSrc={values[cropIndex]}
          onClose={() => setCropIndex(null)}
          onCropComplete={async (croppedBlob) => {
            try {
              const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.jpg`;
              const filePath = folder ? `${folder}/${fileName}` : fileName;
              const { error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(filePath, croppedBlob, {
                  cacheControl: '3600',
                  upsert: false,
                  contentType: 'image/jpeg',
                });
              if (uploadError) throw uploadError;
              const { data: { publicUrl } } = supabase.storage
                .from(bucket)
                .getPublicUrl(filePath);
              const newValues = [...values];
              newValues[cropIndex] = publicUrl;
              onChange(newValues);
              toast.success('Imagem ajustada!');
            } catch (error) {
              console.error('Crop upload error:', error);
              toast.error('Erro ao salvar imagem ajustada');
            } finally {
              setCropIndex(null);
            }
          }}
        />
      )}
    </div>
  );
};

export default MultiImageUpload;
