import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'manager' | 'support' | 'seller' | 'vm_stock' | 'cashier';

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface UserStore {
  id: string;
  name: string;
  slug: string;
  type: 'physical' | 'online' | 'website';
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  allowedMenus: string[];
  userStore: UserStore | null;
  userStoreId: string | null;
  accessibleStoreIds: string[];
  isOnlineStore: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isSeller: boolean;
  canManageProducts: boolean;
  canManageUsers: boolean;
  canManageGoals: boolean;
  hasRole: (role: AppRole) => boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [userStore, setUserStore] = useState<UserStore | null>(null);
  const [accessibleStoreIds, setAccessibleStoreIds] = useState<string[]>([]);
  const [allowedMenus, setAllowedMenus] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Refs prevent stale-closure behavior inside onAuthStateChange
  const currentUserIdRef = useRef<string | null>(null);
  const authBootstrappedRef = useRef(false);

  const fetchUserData = async (userId: string): Promise<void> => {
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (profileData) {
        setProfile(profileData as Profile);
      }

      // Fetch menu permissions
      const { data: menuPerms } = await supabase
        .from('user_menu_permissions')
        .select('allowed_menus')
        .eq('user_id', userId)
        .maybeSingle();

      if (menuPerms?.allowed_menus) {
        setAllowedMenus(menuPerms.allowed_menus as string[]);
      } else {
        setAllowedMenus([]);
      }

      // Fetch roles with store_id
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role, store_id')
        .eq('user_id', userId);

      if (rolesData) {
        setRoles(rolesData.map(r => r.role as AppRole));
        
        // Fetch store info if user has a store_id
        const storeId = rolesData[0]?.store_id;
        if (storeId) {
          const { data: storeData } = await supabase
            .from('stores')
            .select('id, name, slug, type')
            .eq('id', storeId)
            .single();
          
          if (storeData) {
            setUserStore(storeData as UserStore);
            
            // If user is from 'online' store, also include 'website' store
            if (storeData.type === 'online') {
              const { data: websiteStore } = await supabase
                .from('stores')
                .select('id')
                .eq('type', 'website')
                .maybeSingle();
              setAccessibleStoreIds(websiteStore ? [storeId, websiteStore.id] : [storeId]);
            } else {
              setAccessibleStoreIds([storeId]);
            }
          }
        } else {
          setUserStore(null);
          setAccessibleStoreIds([]);
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  useEffect(() => {
    let initialLoadDone = false;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        // Skip INITIAL_SESSION event — handled by getSession below
        if (event === 'INITIAL_SESSION') return;

        if (newSession?.user) {
          const nextUserId = newSession.user.id;
          const sameUser = currentUserIdRef.current === nextUserId;
          const shouldBlockUI = !authBootstrappedRef.current || !sameUser;
          const isRepeatedSignIn = sameUser && event === 'SIGNED_IN';
          const shouldRefetchUserData = !isRepeatedSignIn && (!sameUser || event === 'USER_UPDATED');

          setSession(newSession);
          setUser(newSession.user);
          currentUserIdRef.current = nextUserId;

          if (shouldBlockUI) {
            setIsLoading(true);
          }

          // Fire-and-forget to avoid blocking auth event processing
          if (shouldRefetchUserData) {
            setTimeout(() => {
              void fetchUserData(nextUserId).finally(() => {
                if (shouldBlockUI) {
                  setIsLoading(false);
                }
              });
            }, 0);
          } else if (shouldBlockUI) {
            setIsLoading(false);
          }
        } else {
          currentUserIdRef.current = null;
          setSession(null);
          setUser(null);
          setProfile(null);
          setRoles([]);
          setUserStore(null);
          setAllowedMenus([]);
          setAccessibleStoreIds([]);
          setIsLoading(false);
        }
      }
    );

    // THEN get initial session (single source of truth for first load)
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (initialLoadDone) return;
      initialLoadDone = true;

      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      currentUserIdRef.current = initialSession?.user?.id ?? null;
      
      if (initialSession?.user) {
        await fetchUserData(initialSession.user.id);
      }

      authBootstrappedRef.current = true;
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName }
      }
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    currentUserIdRef.current = null;
    authBootstrappedRef.current = true;
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setUserStore(null);
    setAccessibleStoreIds([]);
    setAllowedMenus([]);
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  const isAdmin = hasRole('admin');
  const isManager = hasRole('manager') || isAdmin;
  const isSeller = hasRole('seller');
  const canManageProducts = isAdmin || isManager;
  const canManageUsers = isAdmin;
  const canManageGoals = isAdmin || isManager;
  const userStoreId = userStore?.id || null;
  const isOnlineStore = userStore?.type === 'online' || userStore?.type === 'website';

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        allowedMenus,
        userStore,
        userStoreId,
        accessibleStoreIds,
        isOnlineStore,
        isLoading,
        isAdmin,
        isManager,
        isSeller,
        canManageProducts,
        canManageUsers,
        canManageGoals,
        hasRole,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
