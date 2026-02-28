import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import StoreLayout from '@/components/store/StoreLayout';
import { categoriesService, Category } from '@/services/categories';

const CategoriesPage = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await categoriesService.getAll();
        setCategories(data.filter(c => c.is_active));
      } catch (error) {
        console.error('Error loading categories:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadCategories();
  }, []);

  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Categorias</h1>
        <p className="text-muted-foreground mb-8">Explore nossos produtos por categoria</p>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : categories.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
            {categories.map((category) => (
              <Link
                key={category.id}
                to={`/loja/categoria/${category.slug}`}
                className="group relative overflow-hidden rounded-xl border bg-card aspect-[4/5] flex flex-col items-center justify-end transition-shadow hover:shadow-lg"
              >
                {category.image_url ? (
                  <img
                    src={category.image_url}
                    alt={category.name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 bg-muted" />
                )}
                <div className="relative z-10 w-full p-4 bg-gradient-to-t from-black/70 to-transparent">
                  <h3 className="text-white font-semibold text-sm md:text-base text-center">
                    {category.name}
                  </h3>
                  {category.description && (
                    <p className="text-white/70 text-xs text-center mt-1 line-clamp-2">
                      {category.description}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-24">
            <p className="text-muted-foreground">Nenhuma categoria encontrada.</p>
          </div>
        )}
      </div>
    </StoreLayout>
  );
};

export default CategoriesPage;
