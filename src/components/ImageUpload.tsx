import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Upload, X, Loader2, ImageIcon, Crop } from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import ImageCropModal from './ImageCropModal';

interface ImageUploadProps {
  value?: string;
  onChange: (url: string | undefined) => void;
  bucket: string;
  folder?: string;
}

const ImageUpload = ({ value, onChange, bucket, folder = '' }: ImageUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isHeic = /\.(heic|heif)$/i.test(file.name) || /heic|heif/i.test(file.type);
    if (isHeic) {
      toast.error('Formato HEIC/HEIF não é suportado. Converta para JPG ou PNG antes de enviar.');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem (JPG, PNG ou WEBP)');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 20MB');
      return;
    }

    // Open cropper with the selected file
    const objectUrl = URL.createObjectURL(file);
    setCropSrc(objectUrl);
    setPendingFile(file);
  };

  const uploadFile = async (fileOrBlob: Blob) => {
    setIsUploading(true);
    try {
      // Always save as .jpg since the cropper outputs jpeg blobs
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.jpg`;
      const filePath = folder ? `${folder}/${fileName}` : fileName;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, fileOrBlob, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/jpeg',
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      onChange(publicUrl);
      toast.success('Imagem enviada com sucesso!');
    } catch (error: any) {
      console.error('Upload error:', error);
      const msg = error?.message || error?.error || 'Erro desconhecido';
      if (/row-level security|permission|unauthor/i.test(msg)) {
        toast.error('Sem permissão para enviar imagem. Faça login novamente.');
      } else if (/payload|too large|size/i.test(msg)) {
        toast.error('Imagem muito grande. Tente uma menor.');
      } else if (/network|fetch|failed/i.test(msg)) {
        toast.error('Falha de conexão. Verifique sua internet e tente novamente.');
      } else {
        toast.error(`Erro ao enviar imagem: ${msg}`);
      }
    } finally {
      setIsUploading(false);
      setCropSrc(null);
      setPendingFile(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    uploadFile(croppedBlob);
  };

  const handleCropClose = () => {
    // Upload original file without cropping
    if (pendingFile) {
      uploadFile(pendingFile);
    } else {
      setCropSrc(null);
      setPendingFile(null);
    }
  };

  const handleEditExisting = () => {
    if (value) {
      setCropSrc(value);
      setPendingFile(null);
    }
  };

  const handleEditCropComplete = async (croppedBlob: Blob) => {
    setIsUploading(true);
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

      onChange(publicUrl);
      toast.success('Imagem ajustada com sucesso!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erro ao salvar imagem ajustada');
    } finally {
      setIsUploading(false);
      setCropSrc(null);
    }
  };

  const handleRemove = () => {
    onChange(undefined);
  };

  return (
    <div className="space-y-3">
      {value ? (
        <div className="relative inline-block group">
          <img
            src={value}
            alt="Preview"
            className="h-32 w-32 rounded-lg object-cover border"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6"
            onClick={handleRemove}
          >
            <X className="h-3 w-3" />
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute -bottom-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleEditExisting}
              >
                <Crop className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Ajustar imagem</TooltipContent>
          </Tooltip>
        </div>
      ) : (
        <div className="flex items-center justify-center h-32 w-32 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50">
          <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
        </div>
      )}

      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          id="image-upload"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              {value ? 'Trocar imagem' : 'Enviar imagem'}
            </>
          )}
        </Button>
      </div>

      {cropSrc && (
        <ImageCropModal
          open={!!cropSrc}
          imageSrc={cropSrc}
          onClose={() => {
            setCropSrc(null);
            setPendingFile(null);
            if (inputRef.current) inputRef.current.value = '';
          }}
          onCropComplete={pendingFile ? handleCropComplete : handleEditCropComplete}
        />
      )}
    </div>
  );
};

export default ImageUpload;
