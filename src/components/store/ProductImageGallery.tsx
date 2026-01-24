import { useState, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, X, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ProductImageGalleryProps {
  images: string[];
  productName: string;
  selectedImage?: string;
  onImageChange?: (image: string) => void;
}

const ProductImageGallery = ({ 
  images, 
  productName, 
  selectedImage,
  onImageChange 
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

  const currentImage = images[currentIndex] || null;

  const handlePrevious = useCallback(() => {
    const newIndex = currentIndex === 0 ? images.length - 1 : currentIndex - 1;
    setCurrentIndex(newIndex);
    onImageChange?.(images[newIndex]);
  }, [currentIndex, images, onImageChange]);

  const handleNext = useCallback(() => {
    const newIndex = currentIndex === images.length - 1 ? 0 : currentIndex + 1;
    setCurrentIndex(newIndex);
    onImageChange?.(images[newIndex]);
  }, [currentIndex, images, onImageChange]);

  const handleThumbnailClick = useCallback((index: number) => {
    setCurrentIndex(index);
    onImageChange?.(images[index]);
  }, [images, onImageChange]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageContainerRef.current) return;
    
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setZoomPosition({ x, y });
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsZoomed(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsZoomed(false);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      handlePrevious();
    } else if (e.key === 'ArrowRight') {
      handleNext();
    } else if (e.key === 'Escape') {
      setIsLightboxOpen(false);
    }
  }, [handlePrevious, handleNext]);

  // Sync with external selectedImage changes
  if (selectedImage && images[currentIndex] !== selectedImage) {
    const newIndex = images.findIndex(img => img === selectedImage);
    if (newIndex >= 0 && newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
    }
  }

  if (images.length === 0) {
    return (
      <div className="space-y-4">
        <div className="aspect-square rounded-xl overflow-hidden bg-muted border flex items-center justify-center">
          <Package className="h-24 w-24 text-muted-foreground/30" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Main Image with Zoom */}
      <div className="relative group">
        <div
          ref={imageContainerRef}
          className="aspect-square rounded-xl overflow-hidden bg-muted border cursor-zoom-in relative"
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={() => setIsLightboxOpen(true)}
        >
          {currentImage ? (
            <>
              {/* Normal Image */}
              <img
                src={currentImage}
                alt={`${productName} - Imagem ${currentIndex + 1}`}
                className={cn(
                  "w-full h-full object-cover transition-opacity duration-200",
                  isZoomed ? "opacity-0" : "opacity-100"
                )}
              />
              
              {/* Zoomed Image */}
              <div
                className={cn(
                  "absolute inset-0 transition-opacity duration-200",
                  isZoomed ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                style={{
                  backgroundImage: `url(${currentImage})`,
                  backgroundSize: '200%',
                  backgroundPosition: `${zoomPosition.x}% ${zoomPosition.y}%`,
                }}
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-24 w-24 text-muted-foreground/30" />
            </div>
          )}

          {/* Zoom indicator */}
          <div className={cn(
            "absolute bottom-4 right-4 bg-background/80 backdrop-blur-sm rounded-full p-2 transition-opacity",
            "opacity-0 group-hover:opacity-100"
          )}>
            <ZoomIn className="h-5 w-5 text-foreground" />
          </div>
        </div>

        {/* Navigation Arrows */}
        {images.length > 1 && (
          <>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full",
                "bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity",
                "hover:bg-background shadow-md"
              )}
              onClick={(e) => {
                e.stopPropagation();
                handlePrevious();
              }}
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
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </>
        )}

        {/* Image Counter */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-4 bg-background/80 backdrop-blur-sm rounded-full px-3 py-1 text-sm font-medium">
            {currentIndex + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => handleThumbnailClick(index)}
              className={cn(
                "w-20 h-20 rounded-lg overflow-hidden border-2 shrink-0 transition-all",
                index === currentIndex 
                  ? "border-store-primary ring-2 ring-store-primary/20" 
                  : "border-transparent hover:border-muted-foreground/30"
              )}
            >
              <img
                src={image}
                alt={`${productName} - Miniatura ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox Dialog */}
      <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none">
          <div className="relative w-full h-[90vh] flex items-center justify-center">
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-50 text-white hover:bg-white/20 h-10 w-10"
              onClick={() => setIsLightboxOpen(false)}
            >
              <X className="h-6 w-6" />
            </Button>

            {/* Main Image */}
            <img
              src={currentImage || ''}
              alt={`${productName} - Imagem ${currentIndex + 1}`}
              className="max-w-full max-h-full object-contain"
            />

            {/* Navigation */}
            {images.length > 1 && (
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

            {/* Thumbnails in Lightbox */}
            {images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 backdrop-blur-sm rounded-lg p-2">
                {images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => handleThumbnailClick(index)}
                    className={cn(
                      "w-14 h-14 rounded-md overflow-hidden border-2 transition-all",
                      index === currentIndex 
                        ? "border-white" 
                        : "border-transparent opacity-60 hover:opacity-100"
                    )}
                  >
                    <img
                      src={image}
                      alt={`Miniatura ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Counter */}
            <div className="absolute top-4 left-4 text-white/80 text-sm font-medium">
              {currentIndex + 1} / {images.length}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductImageGallery;
