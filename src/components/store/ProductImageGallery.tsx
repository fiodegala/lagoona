import { useState, useRef, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, X, Package, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { mediumImageUrl, fullImageUrl, thumbnailUrl } from '@/lib/imageUtils';

interface MediaItem {
  type: 'image' | 'video';
  url: string;
  /** For YouTube/Vimeo embeds */
  embedUrl?: string;
  thumbnail?: string;
}

interface ProductImageGalleryProps {
  images: string[];
  productName: string;
  selectedImage?: string;
  onImageChange?: (image: string) => void;
  videoUrl?: string;
}

function parseVideoUrl(url: string): { embedUrl: string; thumbnail: string } | null {
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
    return {
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`,
      thumbnail: `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`,
    };
  }
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return {
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`,
      thumbnail: '',
    };
  }
  // Instagram Reels / Posts
  const instaMatch = url.match(/instagram\.com\/(?:reel|p)\/([a-zA-Z0-9_-]+)/);
  if (instaMatch) {
    return {
      embedUrl: `https://www.instagram.com/p/${instaMatch[1]}/embed/`,
      thumbnail: '',
    };
  }
  // TikTok
  const tiktokMatch = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/);
  if (tiktokMatch) {
    return {
      embedUrl: `https://www.tiktok.com/embed/v2/${tiktokMatch[1]}`,
      thumbnail: '',
    };
  }
  return null;
}

const ProductImageGallery = ({ 
  images, 
  productName, 
  selectedImage,
  onImageChange,
  videoUrl,
}: ProductImageGalleryProps) => {
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (selectedImage) {
      const index = images.findIndex(img => img === selectedImage);
      return index >= 0 ? index : 0;
    }
    return 0;
  });
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 });
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Build media items: images first, then video at the end
  const mediaItems: MediaItem[] = useMemo(() => {
    const items: MediaItem[] = images.map(url => ({ type: 'image' as const, url }));
    if (videoUrl?.trim()) {
      const parsed = parseVideoUrl(videoUrl);
      if (parsed) {
        items.push({ type: 'video', url: videoUrl, embedUrl: parsed.embedUrl, thumbnail: parsed.thumbnail });
      } else {
        // Direct video URL (.mp4 etc)
        items.push({ type: 'video', url: videoUrl });
      }
    }
    return items;
  }, [images, videoUrl]);

  const currentItem = mediaItems[currentIndex] || null;

  const handlePrevious = useCallback(() => {
    const newIndex = currentIndex === 0 ? mediaItems.length - 1 : currentIndex - 1;
    setCurrentIndex(newIndex);
    const item = mediaItems[newIndex];
    if (item?.type === 'image') onImageChange?.(item.url);
  }, [currentIndex, mediaItems, onImageChange]);

  const handleNext = useCallback(() => {
    const newIndex = currentIndex === mediaItems.length - 1 ? 0 : currentIndex + 1;
    setCurrentIndex(newIndex);
    const item = mediaItems[newIndex];
    if (item?.type === 'image') onImageChange?.(item.url);
  }, [currentIndex, mediaItems, onImageChange]);

  const handleThumbnailClick = useCallback((index: number) => {
    setCurrentIndex(index);
    const item = mediaItems[index];
    if (item?.type === 'image') onImageChange?.(item.url);
  }, [mediaItems, onImageChange]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPosition({ x, y });
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') handlePrevious();
    else if (e.key === 'ArrowRight') handleNext();
    else if (e.key === 'Escape') setIsLightboxOpen(false);
  }, [handlePrevious, handleNext]);

  // Sync with external selectedImage changes
  if (selectedImage && currentItem?.type === 'image' && currentItem.url !== selectedImage) {
    const newIndex = mediaItems.findIndex(m => m.type === 'image' && m.url === selectedImage);
    if (newIndex >= 0 && newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
    }
  }

  if (mediaItems.length === 0) {
    return (
      <div className="space-y-4">
        <div className="aspect-square rounded-xl overflow-hidden bg-muted border flex items-center justify-center">
          <Package className="h-24 w-24 text-muted-foreground/30" />
        </div>
      </div>
    );
  }

  const isCurrentVideo = currentItem?.type === 'video';

  const renderMainContent = () => {
    if (!currentItem) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <Package className="h-24 w-24 text-muted-foreground/30" />
        </div>
      );
    }

    if (currentItem.type === 'video') {
      if (currentItem.embedUrl) {
        return (
          <iframe
            src={currentItem.embedUrl}
            title={`${productName} - Vídeo`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        );
      }
      return (
        <video
          src={currentItem.url}
          controls
          className="w-full h-full object-contain bg-black"
          playsInline
        >
          Seu navegador não suporta vídeo.
        </video>
      );
    }

    return (
      <img
        src={mediumImageUrl(currentItem.url)}
        alt={`${productName} - Imagem ${currentIndex + 1}`}
        decoding="async"
        className="w-full h-auto block"
      />
    );
  };

  const renderLightboxContent = () => {
    if (!currentItem) return null;

    if (currentItem.type === 'video') {
      if (currentItem.embedUrl) {
        return (
          <iframe
            src={currentItem.embedUrl}
            title={`${productName} - Vídeo`}
            className="w-full h-full max-w-[90vw] max-h-[80vh] aspect-video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        );
      }
      return (
        <video
          src={currentItem.url}
          controls
          autoPlay
          className="max-w-full max-h-full object-contain"
          playsInline
        />
      );
    }

    return (
      <img
        src={fullImageUrl(currentItem.url)}
        alt={`${productName} - Imagem ${currentIndex + 1}`}
        className="max-w-full max-h-full object-contain"
      />
    );
  };

  return (
    <div className="space-y-4" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Main Image/Video */}
      <div className="relative group">
        <div
          ref={imageContainerRef}
          className="rounded-xl overflow-hidden bg-muted border relative cursor-pointer"
          onClick={!isCurrentVideo ? () => setIsLightboxOpen(true) : undefined}
        >
          {renderMainContent()}
        </div>

        {/* Navigation Arrows */}
        {mediaItems.length > 1 && (
          <>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full",
                "bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity",
                "hover:bg-background shadow-md"
              )}
              onClick={(e) => { e.stopPropagation(); handlePrevious(); }}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full",
                "bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity",
                "hover:bg-background shadow-md"
              )}
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </>
        )}

        {/* Counter */}
        {mediaItems.length > 1 && (
          <div className="absolute bottom-4 left-4 bg-background/80 backdrop-blur-sm rounded-full px-3 py-1 text-sm font-medium">
            {currentIndex + 1} / {mediaItems.length}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {mediaItems.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted">
          {mediaItems.map((item, index) => (
            <button
              key={index}
              onClick={() => handleThumbnailClick(index)}
              className={cn(
                "w-20 h-20 rounded-lg overflow-hidden border-2 shrink-0 transition-all relative",
                index === currentIndex 
                  ? "border-store-primary ring-2 ring-store-primary/20" 
                  : "border-transparent hover:border-muted-foreground/30"
              )}
            >
              {item.type === 'video' ? (
                <div className="w-full h-full bg-muted flex items-center justify-center relative">
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt="Vídeo" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-muted-foreground/10" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Play className="h-6 w-6 text-white fill-white" />
                  </div>
                </div>
              ) : (
                <img
                  src={thumbnailUrl(item.url)}
                  alt={`${productName} - Miniatura ${index + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Lightbox Dialog */}
      <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none">
          <div className="relative w-full h-[90vh] flex items-center justify-center">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-50 text-white hover:bg-white/20 h-10 w-10"
              onClick={() => setIsLightboxOpen(false)}
            >
              <X className="h-6 w-6" />
            </Button>

            {renderLightboxContent()}

            {mediaItems.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
                  onClick={handlePrevious}
                >
                  <ChevronLeft className="h-8 w-8" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
                  onClick={handleNext}
                >
                  <ChevronRight className="h-8 w-8" />
                </Button>
              </>
            )}

            {mediaItems.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 backdrop-blur-sm rounded-lg p-2">
                {mediaItems.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => handleThumbnailClick(index)}
                    className={cn(
                      "w-14 h-14 rounded-md overflow-hidden border-2 transition-all relative",
                      index === currentIndex 
                        ? "border-white" 
                        : "border-transparent opacity-60 hover:opacity-100"
                    )}
                  >
                    {item.type === 'video' ? (
                      <div className="w-full h-full bg-muted flex items-center justify-center relative">
                        {item.thumbnail ? (
                          <img src={item.thumbnail} alt="Vídeo" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-white/10" />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Play className="h-4 w-4 text-white fill-white" />
                        </div>
                      </div>
                    ) : (
                      <img
                        src={item.url}
                        alt={`Miniatura ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="absolute top-4 left-4 text-white/80 text-sm font-medium">
              {currentIndex + 1} / {mediaItems.length}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductImageGallery;
