/* Auth context - v2 roles */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { normalizeAllowedMenuKeys } from '@/config/menuItems';

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
  hasExplicitMenuPermissions: boolean;
  userStore: UserStore | null;
  userStoreId: string | null;
  accessibleStoreIds: string[];
  /** Loja principal + lojas extras atribuídas (sem a loja 'website' automática). */
  managedStoreIds: string[];
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
  const [managedStoreIds, setManagedStoreIds] = useState<string[]>([]);
  const [allowedMenus, setAllowedMenus] = useState<string[]>([]);
  const [hasExplicitMenuPermissions, setHasExplicitMenuPermissions] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userDataLoaded, setUserDataLoaded] = useState(false);

  // Refs prevent stale-closure behavior inside onAuthStateChange
  const currentUserIdRef = useRef<string | null>(null);
  const authBootstrappedRef = useRef(false);

  const fetchUserData = async (userId: string): Promise<void> => {
    try {
      setUserDataLoaded(false);
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

      setHasExplicitMenuPermissions(!!menuPerms);
      setAllowedMenus(normalizeAllowedMenuKeys(menuPerms?.allowed_menus as string[] | null | undefined));

      // Fetch roles with store_id
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role, store_id')
        .eq('user_id', userId);

      if (rolesData) {
        setRoles(rolesData.map(r => r.role as AppRole));

        // Lojas extras (gerentes podem gerir mais de uma loja)
        const { data: extraData } = await supabase
          .from('user_extra_stores')
          .select('store_id')
          .eq('user_id', userId);
        const extraIds = (extraData || []).map((r) => r.store_id as string);

        const storeId = rolesData[0]?.store_id;
        const ownIds = [...new Set([storeId, ...extraIds].filter(Boolean) as string[])];
        if (ownIds.length > 0) {
          const { data: storesData } = await supabase
            .from('stores')
            .select('id, name, slug, type')
            .in('id', ownIds);
          const list = (storesData || []) as UserStore[];
          const primary = list.find((st) => st.id === storeId) || list[0] || null;
          setUserStore(primary);

          let accessible = primary ? [primary.id, ...ownIds.filter((id) => id !== primary.id)] : ownIds;
          // Lojas 'online' também enxergam a loja 'website'
          if (list.some((st) => st.type === 'online')) {
            const { data: websiteStore } = await supabase
              .from('stores')
              .select('id')
              .eq('type', 'website')
              .maybeSingle();
            if (websiteStore && !accessible.includes(websiteStore.id)) accessible = [...accessible, websiteStore.id];
          }
          setAccessibleStoreIds(accessible);
          setManagedStoreIds(primary ? [primary.id, ...ownIds.filter((id) => id !== primary.id)] : ownIds);
        } else {
          setUserStore(null);
          setAccessibleStoreIds([]);
          setManagedStoreIds([]);
        }
      }
      setUserDataLoaded(true);
    } catch (error) {
      console.error('Error fetching user data:', error);
      setUserDataLoaded(true);
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
      setHasExplicitMenuPermissions(false);
      setAccessibleStoreIds([]);
      setManagedStoreIds([]);
      setUserDataLoaded(false);
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
    setManagedStoreIds([]);
    setAllowedMenus([]);
    setHasExplicitMenuPermissions(false);
    setUserDataLoaded(false);
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  const isAdmin = hasRole('admin');
  const isManager = hasRole('manager') || isAdmin;
  const isSeller = hasRole('seller');
  const canManageProducts = isAdmin || isManager || (hasRole('vm_stock') && allowedMenus.includes('products'));
  const canManageUsers = isAdmin;
  const canManageGoals = isAdmin || isManager;
  const userStoreId = userStore?.id || null;
  const isOnlineStore = userStore?.type === 'online' || userStore?.type === 'website';
  
  // Consider loading until user data is fully loaded for authenticated users
  const effectiveLoading = isLoading || (!!user && !userDataLoaded);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        allowedMenus,
        hasExplicitMenuPermissions,
        userStore,
        userStoreId,
        accessibleStoreIds,
        managedStoreIds,
        isOnlineStore,
        isLoading: effectiveLoading,
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
