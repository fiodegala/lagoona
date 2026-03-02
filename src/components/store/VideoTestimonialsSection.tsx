import { useEffect, useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface VideoTestimonial {
  id: string;
  title: string;
  video_url: string;
  customer_name: string;
  sort_order: number;
}

function parseVideoEmbed(url: string): { embedUrl: string; type: 'iframe' | 'video' } | null {
  if (!url) return null;

  // YouTube Shorts
  const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/);
  if (shortsMatch) {
    return { embedUrl: `https://www.youtube.com/embed/${shortsMatch[1]}?autoplay=0&loop=1`, type: 'iframe' };
  }

  // YouTube standard
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch) {
    return { embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=0`, type: 'iframe' };
  }

  // Instagram Reels
  const igMatch = url.match(/instagram\.com\/reel\/([a-zA-Z0-9_-]+)/);
  if (igMatch) {
    return { embedUrl: `https://www.instagram.com/reel/${igMatch[1]}/embed/`, type: 'iframe' };
  }

  // TikTok
  const ttMatch = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/);
  if (ttMatch) {
    return { embedUrl: `https://www.tiktok.com/embed/v2/${ttMatch[1]}`, type: 'iframe' };
  }

  // Direct video (.mp4, .webm)
  if (url.match(/\.(mp4|webm|ogg)(\?|$)/i)) {
    return { embedUrl: url, type: 'video' };
  }

  // Fallback: try as iframe
  return { embedUrl: url, type: 'iframe' };
}

const VideoTestimonialsSection = () => {
  const [testimonials, setTestimonials] = useState<VideoTestimonial[]>([]);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('video_testimonials')
        .select('id, title, video_url, customer_name, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (data && data.length > 0) {
        setTestimonials(data as VideoTestimonial[]);
      }
    };
    load();
  }, []);

  const videosPerPage = 5;
  const totalPages = Math.ceil(testimonials.length / videosPerPage);

  const currentVideos = useMemo(() => {
    const start = currentPage * videosPerPage;
    return testimonials.slice(start, start + videosPerPage);
  }, [testimonials, currentPage]);

  if (testimonials.length === 0) return null;

  return (
    <section className="py-16 md:py-20 bg-store-secondary/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-display font-bold italic">Depoimentos</h2>
          <div className="w-12 h-0.5 bg-store-gold mt-2 mx-auto" />
          <p className="text-sm text-muted-foreground mt-3">Veja o que nossos clientes dizem</p>
        </div>

        <div className="relative">
          {/* Video grid - 5 per row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {currentVideos.map((testimonial) => {
              const parsed = parseVideoEmbed(testimonial.video_url);
              if (!parsed) return null;

              return (
                <div key={testimonial.id} className="flex flex-col">
                  <div className="relative rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '9/16' }}>
                    {parsed.type === 'iframe' ? (
                      <iframe
                        src={parsed.embedUrl}
                        className="absolute inset-0 w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        loading="lazy"
                        title={testimonial.title || 'Depoimento'}
                      />
                    ) : (
                      <video
                        src={parsed.embedUrl}
                        className="absolute inset-0 w-full h-full object-cover"
                        controls
                        playsInline
                        preload="metadata"
                      />
                    )}
                  </div>
                  {(testimonial.customer_name || testimonial.title) && (
                    <div className="mt-2 text-center">
                      {testimonial.customer_name && (
                        <p className="text-sm font-semibold text-foreground">{testimonial.customer_name}</p>
                      )}
                      {testimonial.title && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{testimonial.title}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                disabled={currentPage === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="flex items-center gap-2">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      i === currentPage ? 'bg-store-gold scale-125' : 'bg-muted-foreground/30'
                    }`}
                    onClick={() => setCurrentPage(i)}
                  />
                ))}
              </div>

              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                disabled={currentPage === totalPages - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default VideoTestimonialsSection;
