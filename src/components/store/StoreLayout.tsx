import { ReactNode, useEffect, useState, lazy, Suspense } from 'react';
import StoreHeader from './StoreHeader';
import TopAnnouncementBar from './TopAnnouncementBar';
import TrustBar from './TrustBar';
import StoreFooter from './StoreFooter';
import WhatsAppButton from './WhatsAppButton';
import FathersDayTheme from './FathersDayTheme';
import { categoriesService, Category } from '@/services/categories';
import { useAnalyticsTracker } from '@/hooks/useAnalyticsTracker';

// Lazy load non-critical widgets
const AIChatWidget = lazy(() => import('./AIChatWidget'));
const SpinWheel = lazy(() => import('./SpinWheel'));
const ScorePredictionPopup = lazy(() => import('./ScorePredictionPopup'));

interface StoreLayoutProps {
  children: ReactNode;
}

const StoreLayout = ({ children }: StoreLayoutProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  useAnalyticsTracker();

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await categoriesService.getAll();
        setCategories(data);
      } catch (error) {
        console.error('Error loading categories:', error);
      }
    };
    loadCategories();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background overflow-x-hidden w-full relative">
      <FathersDayTheme />
      <TopAnnouncementBar />
      <StoreHeader categories={categories} />
      <TrustBar />
      <main className="flex-1">
        {children}
      </main>
      <StoreFooter />
      <Suspense fallback={null}>
        <AIChatWidget />
        <SpinWheel />
        <ScorePredictionPopup />
      </Suspense>
      <WhatsAppButton phoneNumber="5562994165785" />
    </div>
  );
};

export default StoreLayout;
