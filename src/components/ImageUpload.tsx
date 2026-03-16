import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Upload, X, Loader2, ImageIcon, Maximize, Minimize } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ImageUploadProps {
  value?: string;
  onChange: (url: string | undefined) => void;
  bucket: string;
  folder?: string;
}

const ImageUpload = ({ value, onChange, bucket, folder = '' }: ImageUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [objectFit, setObjectFit] = useState<'cover' | 'contain'>('cover');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 20MB');
      return;
    }

    setIsUploading(true);

    try {
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
      const filePath = folder ? `${folder}/${fileName}` : fileName;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      onChange(publicUrl);
      toast.success('Imagem enviada com sucesso!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erro ao enviar imagem');
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    onChange(undefined);
  };

  return (
    <div className="space-y-3">
      {value ? (
        <div className="relative inline-block">
          <img
            src={value}
            alt="Preview"
            className={cn(
              "h-32 w-32 rounded-lg border",
              objectFit === 'cover' ? 'object-cover' : 'object-contain bg-muted'
            )}
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
                className="absolute -bottom-2 -right-2 h-6 w-6"
                onClick={() => setObjectFit(objectFit === 'cover' ? 'contain' : 'cover')}
              >
                {objectFit === 'cover' ? (
                  <Minimize className="h-3 w-3" />
                ) : (
                  <Maximize className="h-3 w-3" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {objectFit === 'cover' ? 'Ajustar à área (conter)' : 'Preencher área (cortar)'}
            </TooltipContent>
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
    </div>
  );
};

export default ImageUpload;
