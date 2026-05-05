import { useEffect, useState, useMemo } from 'react';
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';

interface FeedbackPrint {
  id: string;
  image_url: string;
  customer_name: string;
  caption: string;
  sort_order: number;
}

interface TopReview {
  id: string;
  customer_name: string;
  rating: number;
  title: string | null;
  comment: string | null;
  created_at: string;
}

const StarRating = ({ rating }: { rating: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map(i => (
      <Star
        key={i}
        className={`h-4 w-4 ${i <= rating ? 'text-store-gold fill-store-gold' : 'text-muted-foreground/30'}`}
      />
    ))}
  </div>
);

const CustomerFeedbackSection = () => {
  const [prints, setPrints] = useState<FeedbackPrint[]>([]);
  const [reviews, setReviews] = useState<TopReview[]>([]);
  const [currentPrintPage, setCurrentPrintPage] = useState(0);

  useEffect(() => {
    const load = async () => {
      const [printsRes, reviewsRes] = await Promise.all([
        supabase
          .from('customer_feedback_prints')
          .select('id, image_url, customer_name, caption, sort_order')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
        supabase
          .from('product_reviews_public' as any)
          .select('id, customer_name, rating, title, comment, created_at')
          .gte('rating', 4)
          .order('created_at', { ascending: false })
          .limit(6) as any,
      ]);

      if (printsRes.data) setPrints(printsRes.data as FeedbackPrint[]);
      if (reviewsRes.data) setReviews(reviewsRes.data as TopReview[]);
    };
    load();
  }, []);

  const printsPerPage = 4;
  const totalPrintPages = Math.ceil(prints.length / printsPerPage);
  const currentPrints = useMemo(() => {
    const start = currentPrintPage * printsPerPage;
    return prints.slice(start, start + printsPerPage);
  }, [prints, currentPrintPage]);

  if (prints.length === 0 && reviews.length === 0) return null;

  const defaultTab = prints.length > 0 ? 'prints' : 'reviews';

  return (
    <section className="py-12 md:py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-display font-bold italic">
            O que dizem nossos clientes
          </h2>
          <div className="w-12 h-0.5 bg-store-gold mt-2 mx-auto" />
          <p className="text-sm text-muted-foreground mt-3">
            Feedbacks reais de quem já comprou com a gente
          </p>
        </div>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="mx-auto mb-8 grid w-full max-w-sm grid-cols-2">
            {prints.length > 0 && (
              <TabsTrigger value="prints">📱 Prints</TabsTrigger>
            )}
            {reviews.length > 0 && (
              <TabsTrigger value="reviews">⭐ Avaliações</TabsTrigger>
            )}
          </TabsList>

          {prints.length > 0 && (
            <TabsContent value="prints">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {currentPrints.map((print) => (
                  <div
                    key={print.id}
                    className="group relative rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow bg-background border"
                  >
                    <img
                      src={print.image_url}
                      alt={print.customer_name ? `Feedback de ${print.customer_name}` : 'Feedback de cliente'}
                      className="w-full aspect-[9/16] object-cover"
                      loading="lazy"
                    />
                    {(print.customer_name || print.caption) && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
                        {print.customer_name && (
                          <p className="text-white text-sm font-semibold">{print.customer_name}</p>
                        )}
                        {print.caption && (
                          <p className="text-white/70 text-xs line-clamp-2">{print.caption}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {totalPrintPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-6">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={() => setCurrentPrintPage(prev => Math.max(0, prev - 1))}
                    disabled={currentPrintPage === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-2">
                    {Array.from({ length: totalPrintPages }).map((_, i) => (
                      <button
                        key={i}
                        className={`w-2 h-2 rounded-full transition-all ${
                          i === currentPrintPage ? 'bg-store-gold scale-125' : 'bg-muted-foreground/30'
                        }`}
                        onClick={() => setCurrentPrintPage(i)}
                      />
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={() => setCurrentPrintPage(prev => Math.min(totalPrintPages - 1, prev + 1))}
                    disabled={currentPrintPage === totalPrintPages - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </TabsContent>
          )}

          {reviews.length > 0 && (
            <TabsContent value="reviews">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="bg-background rounded-xl p-5 shadow-sm border hover:shadow-md transition-shadow relative"
                  >
                    <Quote className="absolute top-3 right-3 h-6 w-6 text-store-gold/20" />
                    <StarRating rating={review.rating} />
                    {review.title && (
                      <h4 className="font-semibold mt-3 text-sm">{review.title}</h4>
                    )}
                    {review.comment && (
                      <p className="text-muted-foreground text-sm mt-2 line-clamp-3">
                        {review.comment}
                      </p>
                    )}
                    <p className="text-xs font-medium mt-3 text-store-gold">
                      — {review.customer_name}
                    </p>
                  </div>
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </section>
  );
};

export default CustomerFeedbackSection;
