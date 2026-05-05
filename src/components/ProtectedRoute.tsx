import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

// Map route paths to menuKeys for permission checking
const routeToMenuKey: Record<string, string> = {
  '/admin/products': 'products',
  '/admin/categories': 'categories',
  '/admin/curva-abc': 'abc-curve',
  '/admin/reviews': 'reviews',
  '/admin/coupons': 'coupons',
  '/admin/coupons/usos': 'coupon-usages',
  '/admin/combos': 'combos',
  '/admin/upsells': 'upsells',
  '/admin/shipping': 'shipping',
  '/admin/banners': 'banners',
  '/admin/analytics': 'analytics',
  '/admin/users': 'users',
  '/admin/audit-logs': 'audit-logs',
  '/admin/afiliados': 'affiliates',
  '/admin/olist': 'olist',
  '/admin/importar-csv': 'import-csv',
  '/admin/importar-legado': 'import-legacy',
  '/admin/importar-dados': 'import-data',
  '/admin/ordens-servico': 'service-orders',
  '/admin/service-orders': 'service-orders',
  '/admin/comunicados': 'announcements',
  '/admin/settings/api-keys': 'api-keys',
  '/admin/settings/api-docs': 'api-docs',
  '/admin/database-export': 'database-export',
};

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'manager' | 'support' | 'vm_stock' | 'cashier';
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, roles, isLoading, allowedMenus } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles.length === 0) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole) {
    const hasRequiredRole = roles.includes(requiredRole) || 
      (requiredRole === 'manager' && roles.includes('admin')) ||
      (requiredRole === 'support' && (roles.includes('admin') || roles.includes('manager')));

    if (!hasRequiredRole) {
      const menuKey = routeToMenuKey[location.pathname];
      const hasExplicitPermission = menuKey && allowedMenus.length > 0 && allowedMenus.includes(menuKey);
      
      if (!hasExplicitPermission) {
        return <Navigate to="/admin" replace />;
      }
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
