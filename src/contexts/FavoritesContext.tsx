import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

interface FavoritesContextType {
  favorites: string[];
  addFavorite: (productId: string) => void;
  removeFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (productId: string) => void;
  clearFavorites: () => void;
  isLoading: boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

const FAVORITES_STORAGE_KEY = 'lagoona-favorites';

export const FavoritesProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Listen to auth state changes directly from Supabase
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load favorites from localStorage (for non-authenticated users or initial load)
  const loadLocalFavorites = useCallback(() => {
    const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  }, []);

  // Save favorites to localStorage
  const saveLocalFavorites = useCallback((favs: string[]) => {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favs));
  }, []);

  // Load favorites from database
  const loadDatabaseFavorites = useCallback(async () => {
    if (!user) return [];
    
    const { data, error } = await supabase
      .from('user_favorites')
      .select('product_id')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error loading favorites from database:', error);
      return [];
    }

    return data?.map(f => f.product_id) || [];
  }, [user]);

  // Sync local favorites to database when user logs in
  const syncLocalToDatabase = useCallback(async (localFavorites: string[]) => {
    if (!user || localFavorites.length === 0) return;

    // Get existing database favorites
    const dbFavorites = await loadDatabaseFavorites();
    
    // Find favorites that are in local but not in database
    const toAdd = localFavorites.filter(id => !dbFavorites.includes(id));

    if (toAdd.length > 0) {
      const { error } = await supabase
        .from('user_favorites')
        .insert(toAdd.map(product_id => ({ user_id: user.id, product_id })));

      if (error) {
        console.error('Error syncing favorites to database:', error);
      }
    }
  }, [user, loadDatabaseFavorites]);

  // Load favorites based on auth state
  useEffect(() => {
    const loadFavorites = async () => {
      setIsLoading(true);
      
      if (user) {
        // User is logged in - load from database and sync local favorites
        const localFavorites = loadLocalFavorites();
        await syncLocalToDatabase(localFavorites);
        
        const dbFavorites = await loadDatabaseFavorites();
        setFavorites(dbFavorites);
        
        // Clear local storage after syncing
        if (localFavorites.length > 0) {
          localStorage.removeItem(FAVORITES_STORAGE_KEY);
        }
      } else {
        // User is not logged in - use localStorage
        setFavorites(loadLocalFavorites());
      }
      
      setIsLoading(false);
    };

    loadFavorites();
  }, [user, loadLocalFavorites, loadDatabaseFavorites, syncLocalToDatabase]);

  const addFavorite = useCallback(async (productId: string) => {
    if (favorites.includes(productId)) return;

    // Optimistic update
    setFavorites(prev => [...prev, productId]);

    if (user) {
      // Save to database
      const { error } = await supabase
        .from('user_favorites')
        .insert({ user_id: user.id, product_id: productId });

      if (error) {
        console.error('Error adding favorite:', error);
        // Rollback on error
        setFavorites(prev => prev.filter(id => id !== productId));
      }
    } else {
      // Save to localStorage
      const updated = [...favorites, productId];
      saveLocalFavorites(updated);
    }
  }, [favorites, user, saveLocalFavorites]);

  const removeFavorite = useCallback(async (productId: string) => {
    // Optimistic update
    setFavorites(prev => prev.filter(id => id !== productId));

    if (user) {
      // Remove from database
      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', productId);

      if (error) {
        console.error('Error removing favorite:', error);
        // Rollback on error
        setFavorites(prev => [...prev, productId]);
      }
    } else {
      // Remove from localStorage
      const updated = favorites.filter(id => id !== productId);
      saveLocalFavorites(updated);
    }
  }, [favorites, user, saveLocalFavorites]);

  const isFavorite = useCallback((productId: string) => {
    return favorites.includes(productId);
  }, [favorites]);

  const toggleFavorite = useCallback((productId: string) => {
    if (isFavorite(productId)) {
      removeFavorite(productId);
    } else {
      addFavorite(productId);
    }
  }, [isFavorite, removeFavorite, addFavorite]);

  const clearFavorites = useCallback(async () => {
    // Optimistic update
    const previousFavorites = [...favorites];
    setFavorites([]);

    if (user) {
      // Clear from database
      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        console.error('Error clearing favorites:', error);
        // Rollback on error
        setFavorites(previousFavorites);
      }
    } else {
      // Clear localStorage
      localStorage.removeItem(FAVORITES_STORAGE_KEY);
    }
  }, [favorites, user]);

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        addFavorite,
        removeFavorite,
        isFavorite,
        toggleFavorite,
        clearFavorites,
        isLoading,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};
