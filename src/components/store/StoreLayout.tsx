import { ReactNode, useEffect, useState } from 'react';
import StoreHeader from './StoreHeader';
import StoreFooter from './StoreFooter';
import AIChatWidget from './AIChatWidget';
import SpinWheel from './SpinWheel';
import { categoriesService, Category } from '@/services/categories';

interface StoreLayoutProps {
  children: ReactNode;
}

const StoreLayout = ({ children }: StoreLayoutProps) => {
  const [categories, setCategories] = useState<Category[]>([]);

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
    <div className="min-h-screen flex flex-col bg-background">
      <StoreHeader categories={categories} />
      <main className="flex-1">
        {children}
      </main>
      <StoreFooter />
      <AIChatWidget />
      <SpinWheel />
    </div>
  );
};

export default StoreLayout;
