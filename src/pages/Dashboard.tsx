import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Package, ShoppingCart, Key, TrendingUp, Users, DollarSign, 
  Star, Tag, ArrowUpRight, ArrowDownRight, Clock, CheckCircle,
  XCircle, AlertCircle, Store, CreditCard, Banknote, QrCode, Percent,
  Calendar, CalendarRange, Target, TrendingDown
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell 
} from 'recharts';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import BrazilSalesMap from '@/components/dashboard/BrazilSalesMap';
import WhatsAppMetrics from '@/components/dashboard/WhatsAppMetrics';

type PeriodFilter = 'today' | 'week' | 'month' | 'all' | 'custom';

interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  totalReviews: number;
  pendingReviews: number;
  activeCoupons: number;
  totalCategories: number;
}

interface POSStats {
  totalSales: number;
  totalRevenue: number;
  totalDiscount: number;
  paymentMethods: {
    cash: { count: number; total: number };
    card: { count: number; total: number; credit: number; debit: number };
    pix: { count: number; total: number };
    mixed: { count: number; total: number };
  };
  averageTicket: number;
  averageProductTicket: number;
  totalItemsSold: number;
  installmentSales: number;
}

interface RecentOrder {
  id: string;
  customer_name: string | null;
  customer_email: string;
  total: number;
  status: string;
  created_at: string;
}

interface RecentPOSSale {
  id: string;
  customer_name: string | null;
  total: number;
  payment_method: string;
  payment_details: Record<string, unknown> | null;
  discount_amount: number | null;
  created_at: string;
}

interface RawOrder {
  id: string;
  status: string;
  total: number;
  customer_name: string | null;
  customer_email: string;
  payment_method: string | null;
  created_at: string;
  shipping_address: { state?: string; city?: string } | null;
  items: { product_id?: string; name?: string; qty?: number; quantity?: number; price?: number; total?: number; is_lagoona?: boolean; is_promotional?: boolean; original_price?: number }[];
}

interface RawPOSSale {
  id: string;
  customer_name: string | null;
  customer_id: string | null;
  user_id: string;
  total: number;
  payment_method: string;
  payment_details: Record<string, unknown> | null;
  discount_amount: number | null;
  status: string;
  sale_type: string | null;
  notes: string | null;
  items: { product_id?: string; name?: string; qty?: number; quantity?: number; unit_price?: number; price?: number; is_lagoona?: boolean; is_promotional?: boolean; original_price?: number; total?: number }[];
  created_at: string;
}

interface SellerOption {
  user_id: string;
  full_name: string;
}

interface CustomerWithLocation {
  id: string;
  state: string | null;
  city: string | null;
}

interface SalesByState {
  [stateCode: string]: {
    total: number;
    count: number;
    cities: {
      [city: string]: {
        total: number;
        count: number;
      };
    };
  };
}

interface SalesGoal {
  id: string;
  type: 'daily' | 'monthly';
  target_amount: number;
  is_active: boolean;
  store_id: string | null;
}

const SITE_STORE_ID = 'e0b8ebbc-1b3b-4aec-b5f7-6925762e6ea1';
const LAGOONA_STORE_ID = '5e76470a-609c-4e75-a8e3-1c663e66c076';

const Dashboard = () => {
  const { user, profile, roles, isAdmin, userStoreId, userStore, accessibleStoreIds } = useAuth();
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');
  const [selectedSellerId, setSelectedSellerId] = useState<string>('all');
  const [stores, setStores] = useState<{ id: string; name: string; type: string }[]>([]);
  const [sellers, setSellers] = useState<SellerOption[]>([]);
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [rawOrders, setRawOrders] = useState<RawOrder[]>([]);
  const [rawPOSSales, setRawPOSSales] = useState<RawPOSSale[]>([]);
  const [products, setProducts] = useState<{ id: string; is_active: boolean; is_lagoona?: boolean }[]>([]);
  const [reviews, setReviews] = useState<{ id: string; is_approved: boolean }[]>([]);
  const [coupons, setCoupons] = useState<{ id: string; is_active: boolean }[]>([]);
  const [categories, setCategories] = useState<{ id: string; is_active: boolean }[]>([]);
  const [salesGoals, setSalesGoals] = useState<SalesGoal[]>([]);
  const [customers, setCustomers] = useState<CustomerWithLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load stores for selector (admin sees all, online users see their accessible stores)
  useEffect(() => {
    if (isAdmin) {
      supabase.from('stores').select('id, name, type').eq('is_active', true).order('name').then(({ data }) => {
        setStores(data || []);
      });
    } else if (accessibleStoreIds.length > 1) {
      supabase.from('stores').select('id, name, type').in('id', accessibleStoreIds).eq('is_active', true).order('name').then(({ data }) => {
        setStores(data || []);
      });
    }
    // Fetch sellers for the filter
    const fetchSellers = async () => {
      const { data: rolesData } = await supabase.from('user_roles').select('user_id, store_id');
      if (rolesData && rolesData.length > 0) {
        const userIds = [...new Set(rolesData.map(r => r.user_id))];
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
        if (profiles) {
          setSellers(profiles.map(p => ({ user_id: p.user_id, full_name: p.full_name })));
        }
      }
    };
    fetchSellers();
  }, [isAdmin, accessibleStoreIds]);

  // Set default store for non-admin users with multiple stores
  useEffect(() => {
    if (!isAdmin && accessibleStoreIds.length > 1 && selectedStoreId === 'all' && userStoreId) {
      setSelectedStoreId(userStoreId);
    }
  }, [isAdmin, accessibleStoreIds, userStoreId]);
  const showStoreSelector = isAdmin || accessibleStoreIds.length > 1;
  const activeStoreFilter = isAdmin ? (selectedStoreId === 'all' ? null : selectedStoreId) : (accessibleStoreIds.length > 1 ? (selectedStoreId === 'all' ? (userStoreId || null) : selectedStoreId) : userStoreId);
  const isSiteStoreSelected = activeStoreFilter === SITE_STORE_ID;
  const isLagoonaStoreSelected = activeStoreFilter === LAGOONA_STORE_ID;
  const isViewingAllStores = !activeStoreFilter;

  useEffect(() => {
    loadDashboardData();
  }, [activeStoreFilter]);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);

      // Fetch all data in parallel
      const storeFilter = activeStoreFilter;

      // Orders: only include site orders when the Site store is selected.
      // Physical/PDV stores must not inherit website revenue in goal cards.
      let ordersQuery = supabase
        .from('orders')
        .select('id, status, total, customer_name, customer_email, payment_method, created_at, shipping_address, items')
        .in('status', ['confirmed', 'completed', 'delivered', 'processing', 'shipped']);
      if (isSiteStoreSelected) {
        ordersQuery = ordersQuery.eq('store_id', SITE_STORE_ID);
      } else if (isLagoonaStoreSelected) {
        // Fetch all site orders and isolate Lagoona items client-side.
      } else if (storeFilter) {
        ordersQuery = ordersQuery.limit(0);
      }

      // POS Sales: filter by store (Lagoona needs all sales to filter by items)
      let posSalesQuery = supabase.from('pos_sales').select('*').order('created_at', { ascending: false });
      if (isSiteStoreSelected) {
        posSalesQuery = posSalesQuery.eq('store_id', SITE_STORE_ID).limit(0);
      } else if (isLagoonaStoreSelected) {
        // Fetch all POS sales - will filter client-side by is_lagoona items
      } else if (storeFilter) {
        posSalesQuery = posSalesQuery.eq('store_id', storeFilter);
      }

      const [
        productsRes,
        ordersRes,
        reviewsRes,
        couponsRes,
        categoriesRes,
        posSalesRes,
        goalsRes,
        customersRes
      ] = await Promise.all([
        supabase.from('products').select('id, is_active, is_lagoona'),
        ordersQuery,
        supabase.from('product_reviews').select('id, is_approved'),
        supabase.from('coupons').select('id, is_active'),
        supabase.from('categories').select('id, is_active'),
        posSalesQuery,
        supabase.from('sales_goals').select('*').eq('is_active', true),
        supabase.from('customers').select('id, state, city'),
      ]);

      setProducts(productsRes.data || []);
      setRawOrders((ordersRes.data || []).map(order => ({
        ...order,
        shipping_address: order.shipping_address as { state?: string; city?: string } | null,
        items: (order.items as any[] || []),
      })));
      setReviews(reviewsRes.data || []);
      setCoupons(couponsRes.data || []);
      setCategories(categoriesRes.data || []);
      setSalesGoals((goalsRes.data || []) as SalesGoal[]);
      setCustomers((customersRes.data || []) as CustomerWithLocation[]);
      setRawPOSSales((posSalesRes.data || []).map(sale => ({
        id: sale.id,
        customer_name: sale.customer_name,
        customer_id: sale.customer_id,
        user_id: sale.user_id,
        total: Number(sale.total),
        payment_method: sale.payment_method,
        payment_details: sale.payment_details as Record<string, unknown> | null,
        discount_amount: sale.discount_amount ? Number(sale.discount_amount) : null,
        status: sale.status,
        sale_type: (sale as any).sale_type || null,
        notes: sale.notes || null,
        items: (sale.items as any[] || []),
        created_at: sale.created_at,
      })));

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get period date range based on filter
  const getDateRange = (filter: PeriodFilter): { start: Date | null; end: Date | null } => {
    if (filter === 'custom' && customDateRange?.from) {
      const start = new Date(customDateRange.from);
      start.setHours(0, 0, 0, 0);
      const end = customDateRange.to ? new Date(customDateRange.to) : new Date(customDateRange.from);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    switch (filter) {
      case 'today':
        return { start: now, end: null };
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - 7);
        return { start: weekStart, end: null };
      case 'month':
        const monthStart = new Date(now);
        monthStart.setDate(monthStart.getDate() - 30);
        return { start: monthStart, end: null };
      case 'all':
      default:
        return { start: null, end: null };
    }
  };

  const { start: periodStartDate, end: periodEndDate } = getDateRange(periodFilter);
  const lagoonaProductIds = useMemo(
    () => new Set(products.filter(product => product.is_lagoona).map(product => product.id)),
    [products]
  );

  const getItemTotal = (item: { total?: number; price?: number; unit_price?: number; qty?: number; quantity?: number }) => {
    const quantity = Number(item.quantity || item.qty || 1);
    return Number(item.total ?? ((item.price ?? item.unit_price ?? 0) * quantity));
  };

  const isLagoonaItem = (item: { product_id?: string; is_lagoona?: boolean }) => {
    return item.is_lagoona === true || (!!item.product_id && lagoonaProductIds.has(item.product_id));
  };

  // Filter data by period
  const filteredOrders = useMemo(() => {
    const periodOrders = periodStartDate
      ? rawOrders.filter(o => {
          const orderDate = new Date(o.created_at);
          const afterStart = orderDate >= periodStartDate;
          const beforeEnd = !periodEndDate || orderDate <= periodEndDate;
          return afterStart && beforeEnd;
        })
      : rawOrders;

    if (!isLagoonaStoreSelected) return periodOrders;

    return periodOrders
      .map(order => {
        const lagoonaItems = (order.items || []).filter(isLagoonaItem);
        if (lagoonaItems.length === 0) return null;
        return { ...order, items: lagoonaItems, total: lagoonaItems.reduce((sum, item) => sum + getItemTotal(item), 0) };
      })
      .filter(Boolean) as RawOrder[];
  }, [rawOrders, periodStartDate, periodEndDate, isLagoonaStoreSelected, lagoonaProductIds]);

  const filteredPOSSales = useMemo(() => {
    let activeSales = rawPOSSales.filter(s => s.status !== 'cancelled' && s.sale_type !== 'brinde');
    if (selectedSellerId !== 'all') {
      activeSales = activeSales.filter(s => s.user_id === selectedSellerId);
    }
    if (periodStartDate) {
      activeSales = activeSales.filter(s => {
        const saleDate = new Date(s.created_at);
        const afterStart = saleDate >= periodStartDate;
        const beforeEnd = !periodEndDate || saleDate <= periodEndDate;
        return afterStart && beforeEnd;
      });
    }

    // Lagoona filtering: when Lagoona store is selected, only show sales with Lagoona items
    // and recalculate totals based on those items only
    if (isLagoonaStoreSelected) {
      return activeSales
        .map(sale => {
          const lagoonaItems = (sale.items || []).filter(isLagoonaItem);
          if (lagoonaItems.length === 0) return null;
          const lagoonaTotal = lagoonaItems.reduce((sum: number, item: any) => sum + getItemTotal(item), 0);
          return { ...sale, items: lagoonaItems, total: lagoonaTotal };
        })
        .filter(Boolean) as typeof activeSales;
    }

    // For non-Lagoona physical stores, exclude Lagoona items from totals
    if (activeStoreFilter && activeStoreFilter !== SITE_STORE_ID && activeStoreFilter !== LAGOONA_STORE_ID) {
      return activeSales
        .map(sale => {
          const hasLagoonaItems = (sale.items || []).some(isLagoonaItem);
          if (!hasLagoonaItems) return sale;
          const nonLagoonaItems = (sale.items || []).filter((item: any) => !isLagoonaItem(item));
          if (nonLagoonaItems.length === 0) return null;
          const adjustedTotal = nonLagoonaItems.reduce((sum: number, item: any) => sum + getItemTotal(item), 0);
          return { ...sale, items: nonLagoonaItems, total: adjustedTotal };
        })
        .filter(Boolean) as typeof activeSales;
    }

    return activeSales;
  }, [rawPOSSales, periodStartDate, periodEndDate, selectedSellerId, isLagoonaStoreSelected, activeStoreFilter, lagoonaProductIds]);

  // Calculate online stats based on filtered data
  const stats: DashboardStats | null = useMemo(() => {
    if (isLoading) return null;
    
    const completedOrders = filteredOrders.filter(o => ['confirmed', 'completed', 'delivered', 'processing', 'shipped'].includes(o.status));
    const pendingOrders = filteredOrders.filter(o => o.status === 'pending' || o.status === 'processing');
    const cancelledOrders = filteredOrders.filter(o => o.status === 'cancelled');

    return {
      totalProducts: products.length,
      activeProducts: products.filter(p => p.is_active).length,
      totalOrders: filteredOrders.length,
      pendingOrders: pendingOrders.length,
      completedOrders: completedOrders.length,
      cancelledOrders: cancelledOrders.length,
      totalRevenue: completedOrders.reduce((sum, o) => sum + Number(o.total), 0),
      totalReviews: reviews.length,
      pendingReviews: reviews.filter(r => !r.is_approved).length,
      activeCoupons: coupons.filter(c => c.is_active).length,
      totalCategories: categories.filter(c => c.is_active).length,
    };
  }, [filteredOrders, products, reviews, coupons, categories, isLoading]);

  // Calculate POS stats based on filtered data
  const posStats: POSStats | null = useMemo(() => {
    if (isLoading) return null;

    const paymentMethods = {
      cash: { count: 0, total: 0 },
      card: { count: 0, total: 0, credit: 0, debit: 0 },
      pix: { count: 0, total: 0 },
      mixed: { count: 0, total: 0 },
    };

    let installmentSales = 0;

    filteredPOSSales.forEach(sale => {
      const method = sale.payment_method as keyof typeof paymentMethods;
      if (paymentMethods[method]) {
        paymentMethods[method].count++;
        paymentMethods[method].total += Number(sale.total);
        
        if (method === 'card' && sale.payment_details) {
          const details = sale.payment_details;
          if (details.cardType === 'credit') {
            paymentMethods.card.credit++;
            if ((details.installments as number) > 1) {
              installmentSales++;
            }
          } else if (details.cardType === 'debit') {
            paymentMethods.card.debit++;
          }
        }
      }
    });

    const totalPOSRevenue = filteredPOSSales.reduce((sum, s) => sum + Number(s.total), 0);
    const totalPOSDiscount = filteredPOSSales.reduce((sum, s) => sum + Number(s.discount_amount || 0), 0);
    const totalItemsSold = filteredPOSSales.reduce((sum, s) => {
      if (!Array.isArray(s.items)) return sum;
      return sum + (s.items as any[]).reduce((iSum, item) => iSum + Number(item.quantity || item.qty || 1), 0);
    }, 0);

    return {
      totalSales: filteredPOSSales.length,
      totalRevenue: totalPOSRevenue,
      totalDiscount: totalPOSDiscount,
      paymentMethods,
      averageTicket: filteredPOSSales.length > 0 ? totalPOSRevenue / filteredPOSSales.length : 0,
      averageProductTicket: totalItemsSold > 0 ? totalPOSRevenue / totalItemsSold : 0,
      totalItemsSold,
      installmentSales,
    };
  }, [filteredPOSSales, isLoading]);

  // Calculate goal progress
  const goalProgress = useMemo(() => {
    // Find goal: store-specific when filtered, sum of all store goals when showing all
    const findGoalTarget = (type: string): number => {
      if (activeStoreFilter) {
        const goal = salesGoals.find(g => g.type === type && g.store_id === activeStoreFilter);
        return goal?.target_amount || 0;
      }
      // Meta geral = soma de todas as metas de lojas (incluindo site)
      const storeGoals = salesGoals.filter(g => g.type === type && g.store_id);
      if (storeGoals.length > 0) {
        return storeGoals.reduce((sum, g) => sum + Number(g.target_amount), 0);
      }
      // Fallback para meta global antiga sem store_id
      const globalGoal = salesGoals.find(g => g.type === type && !g.store_id);
      return globalGoal?.target_amount || 0;
    };

    const monthlyTarget = findGoalTarget('monthly');

    // Get today's sales (online + POS)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isolateLagoonaOrderTotal = (order: RawOrder) => {
      if (!isLagoonaStoreSelected) return Number(order.total);
      const lagoonaItems = (order.items || []).filter(isLagoonaItem);
      return lagoonaItems.reduce((sum, item) => sum + getItemTotal(item), 0);
    };

    const isolatePOSSaleTotal = (sale: RawPOSSale) => {
      if (isLagoonaStoreSelected) {
        const lagoonaItems = (sale.items || []).filter(isLagoonaItem);
        return lagoonaItems.reduce((sum, item) => sum + getItemTotal(item), 0);
      }
      if (activeStoreFilter && activeStoreFilter !== SITE_STORE_ID && activeStoreFilter !== LAGOONA_STORE_ID) {
        const nonLagoonaItems = (sale.items || []).filter(item => !isLagoonaItem(item));
        return nonLagoonaItems.reduce((sum, item) => sum + getItemTotal(item), 0);
      }
      return Number(sale.total);
    };

    const todayOnlineSales = rawOrders
      .filter(o => {
        const orderDate = new Date(o.created_at);
        return orderDate >= today && orderDate < tomorrow && ['confirmed', 'completed', 'delivered', 'processing', 'shipped'].includes(o.status);
      })
      .reduce((sum, o) => sum + isolateLagoonaOrderTotal(o), 0);

    const todayPOSSales = rawPOSSales
      .filter(s => {
        const saleDate = new Date(s.created_at);
        return saleDate >= today && saleDate < tomorrow && s.status !== 'cancelled';
      })
      .reduce((sum, s) => sum + isolatePOSSaleTotal(s), 0);

    const todayTotal = todayOnlineSales + todayPOSSales;

    // Get current month's sales (online + POS)
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    const monthOnlineSales = rawOrders
      .filter(o => {
        const orderDate = new Date(o.created_at);
        return orderDate >= monthStart && orderDate <= monthEnd && ['confirmed', 'completed', 'delivered', 'processing', 'shipped'].includes(o.status);
      })
      .reduce((sum, o) => sum + isolateLagoonaOrderTotal(o), 0);

    const monthPOSSales = rawPOSSales
      .filter(s => {
        const saleDate = new Date(s.created_at);
        return saleDate >= monthStart && saleDate <= monthEnd && s.status !== 'cancelled';
      })
      .reduce((sum, s) => sum + isolatePOSSaleTotal(s), 0);

    const monthTotal = monthOnlineSales + monthPOSSales;

    // Dynamic daily goal: (monthly target - sold so far) / remaining business days
    const getRemainingWorkingDays = (): number => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const lastDay = new Date(year, month + 1, 0).getDate();
      const currentDay = now.getDate();

      // Brazilian national holidays (fixed dates)
      const fixedHolidays = [
        `${year}-01-01`, // Confraternização Universal
        `${year}-04-21`, // Tiradentes
        `${year}-05-01`, // Dia do Trabalho
        `${year}-09-07`, // Independência
        `${year}-10-12`, // Nossa Senhora Aparecida
        `${year}-11-02`, // Finados
        `${year}-11-15`, // Proclamação da República
        `${year}-12-25`, // Natal
      ];

      // Easter-based holidays (Carnival Mon/Tue, Good Friday, Corpus Christi)
      const getEasterDate = (y: number): Date => {
        const a = y % 19, b = Math.floor(y / 100), c = y % 100;
        const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4), k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const mo = Math.floor((h + l - 7 * m + 114) / 31);
        const da = ((h + l - 7 * m + 114) % 31) + 1;
        return new Date(y, mo - 1, da);
      };
      const easter = getEasterDate(year);
      const addDays = (date: Date, days: number) => {
        const r = new Date(date); r.setDate(r.getDate() + days); return r;
      };
      const easterHolidays = [
        addDays(easter, -48), // Segunda de Carnaval
        addDays(easter, -47), // Terça de Carnaval
        addDays(easter, -2),  // Sexta-feira Santa
        addDays(easter, 60),  // Corpus Christi
      ];
      const holidaySet = new Set([
        ...fixedHolidays,
        ...easterHolidays.map(d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`),
      ]);

      let count = 0;
      for (let d = currentDay; d <= lastDay; d++) {
        const date = new Date(year, month, d);
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0) continue; // Sunday
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (holidaySet.has(dateStr)) continue; // Holiday
        count++;
      }
      return Math.max(count, 1);
    };

    const remainingDays = getRemainingWorkingDays();
    const remainingTarget = Math.max(monthlyTarget - monthTotal, 0);
    const dynamicDailyTarget = monthlyTarget > 0 ? Math.ceil(remainingTarget / remainingDays) : 0;

    return {
      daily: {
        target: dynamicDailyTarget,
        current: todayTotal,
        percentage: dynamicDailyTarget ? Math.min((todayTotal / dynamicDailyTarget) * 100, 100) : 0,
        isComplete: dynamicDailyTarget ? todayTotal >= dynamicDailyTarget : false,
        remainingDays,
      },
      monthly: {
        target: monthlyTarget,
        current: monthTotal,
        percentage: monthlyTarget ? Math.min((monthTotal / monthlyTarget) * 100, 100) : 0,
        isComplete: monthlyTarget ? monthTotal >= monthlyTarget : false,
      },
    };
  }, [rawOrders, rawPOSSales, salesGoals, activeStoreFilter, isLagoonaStoreSelected, lagoonaProductIds]);

  // Recent orders (always show latest 5 within period)
  const recentOrders = useMemo(() => {
    return [...filteredOrders]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [filteredOrders]);

  // Recent POS sales (always show latest 5 within period)
  const recentPOSSales = useMemo(() => {
    return [...filteredPOSSales]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [filteredPOSSales]);

  // Chart data based on period
  const { salesData, posSalesData, comparisonData } = useMemo(() => {
    const getDaysCount = () => {
      if (periodFilter === 'custom' && customDateRange?.from) {
        const endDate = customDateRange.to || customDateRange.from;
        const days = differenceInDays(endDate, customDateRange.from) + 1;
        return Math.min(days, 60); // Limit to 60 days for readability
      }
      switch (periodFilter) {
        case 'today': return 1;
        case 'week': return 7;
        case 'month': return 30;
        case 'all': return 7; // Default to 7 days for chart readability
        default: return 7;
      }
    };

    const getStartDate = () => {
      if (periodFilter === 'custom' && customDateRange?.from) {
        const start = new Date(customDateRange.from);
        start.setHours(0, 0, 0, 0);
        return start;
      }
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      now.setDate(now.getDate() - (getDaysCount() - 1));
      return now;
    };
    
    const daysCount = getDaysCount();
    const startDate = getStartDate();
    const chartData = [];
    const chartDataPOS = [];
    
    for (let i = 0; i < daysCount; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayOrders = filteredOrders.filter(o => {
        const orderDate = new Date(o.created_at);
        return orderDate >= date && orderDate < nextDate && o.status !== 'cancelled';
      });

      const dayPOSSales = filteredPOSSales.filter(s => {
        const saleDate = new Date(s.created_at);
        return saleDate >= date && saleDate < nextDate && s.status !== 'cancelled';
      });

      const dayName = daysCount === 1 
        ? 'Hoje' 
        : daysCount <= 7 
          ? date.toLocaleDateString('pt-BR', { weekday: 'short' })
          : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

      chartData.push({
        name: dayName,
        vendas: dayOrders.length,
        receita: dayOrders.reduce((sum, o) => sum + Number(o.total), 0),
      });

      chartDataPOS.push({
        name: dayName,
        vendas: dayPOSSales.length,
        receita: dayPOSSales.reduce((sum, s) => sum + Number(s.total), 0),
      });
    }
    
    // Create combined data for comparison chart
    const comparisonData = chartData.map((siteData, index) => ({
      name: siteData.name,
      site: siteData.receita,
      pdv: chartDataPOS[index]?.receita || 0,
      siteVendas: siteData.vendas,
      pdvVendas: chartDataPOS[index]?.vendas || 0,
    }));

    return { salesData: chartData, posSalesData: chartDataPOS, comparisonData };
  }, [filteredOrders, filteredPOSSales, periodFilter, customDateRange]);

  // Calculate sales by state/city for map
  const salesByState = useMemo((): SalesByState => {
    const stateData: SalesByState = {};

    // Process POS sales (using customer location)
    filteredPOSSales.forEach(sale => {
      if (!sale.customer_id) return;
      
      const customer = customers.find(c => c.id === sale.customer_id);
      if (!customer?.state) return;

      const stateCode = customer.state.toUpperCase();
      const city = customer.city || 'Não informado';

      if (!stateData[stateCode]) {
        stateData[stateCode] = { total: 0, count: 0, cities: {} };
      }
      stateData[stateCode].total += sale.total;
      stateData[stateCode].count++;

      if (!stateData[stateCode].cities[city]) {
        stateData[stateCode].cities[city] = { total: 0, count: 0 };
      }
      stateData[stateCode].cities[city].total += sale.total;
      stateData[stateCode].cities[city].count++;
    });

    // Process online orders (using shipping address)
    filteredOrders.forEach(order => {
      if (order.status === 'cancelled') return;
      if (!order.shipping_address?.state) return;

      const stateCode = order.shipping_address.state.toUpperCase();
      const city = order.shipping_address.city || 'Não informado';

      if (!stateData[stateCode]) {
        stateData[stateCode] = { total: 0, count: 0, cities: {} };
      }
      stateData[stateCode].total += order.total;
      stateData[stateCode].count++;

      if (!stateData[stateCode].cities[city]) {
        stateData[stateCode].cities[city] = { total: 0, count: 0 };
      }
      stateData[stateCode].cities[city].total += order.total;
      stateData[stateCode].cities[city].count++;
    });

    return stateData;
  }, [filteredPOSSales, filteredOrders, customers]);

  // Order status data for pie chart
  const orderStatusData = stats ? [
    { name: 'Pendentes', value: stats.pendingOrders, color: 'hsl(var(--warning))' },
    { name: 'Concluídos', value: stats.completedOrders, color: 'hsl(var(--success))' },
    { name: 'Cancelados', value: stats.cancelledOrders, color: 'hsl(var(--destructive))' },
  ].filter(d => d.value > 0) : [];

  // Promotional sales stats
  const promotionalStats = useMemo(() => {
    const promoItems: { name: string; qty: number; totalValue: number; paymentMethod: string; source: 'pdv' | 'site' }[] = [];

    filteredPOSSales.forEach(sale => {
      (sale.items || []).forEach((item: any) => {
        if (item.is_promotional) {
          promoItems.push({
            name: item.name || 'Produto',
            qty: item.quantity || item.qty || 1,
            totalValue: item.total || (item.unit_price || 0) * (item.quantity || item.qty || 1),
            paymentMethod: sale.payment_method,
            source: 'pdv',
          });
        }
      });
    });

    filteredOrders.forEach(order => {
      if (order.status === 'cancelled') return;
      (order.items || []).forEach((item: any) => {
        if (item.is_promotional) {
          promoItems.push({
            name: item.name || 'Produto',
            qty: item.quantity || item.qty || 1,
            totalValue: (item.price || 0) * (item.quantity || item.qty || 1),
            paymentMethod: order.payment_method || 'online',
            source: 'site',
          });
        }
      });
    });

    const byProduct: Record<string, { qty: number; total: number }> = {};
    promoItems.forEach(item => {
      if (!byProduct[item.name]) byProduct[item.name] = { qty: 0, total: 0 };
      byProduct[item.name].qty += item.qty;
      byProduct[item.name].total += item.totalValue;
    });

    const PAYMENT_LABELS: Record<string, string> = {
      cash: 'Dinheiro', card: 'Cartão', pix: 'PIX', mixed: 'Misto', online: 'Online',
      credit_card: 'Cartão', debit_card: 'Cartão', boleto: 'Boleto',
    };
    const byPayment: Record<string, { count: number; total: number }> = {};
    promoItems.forEach(item => {
      const label = PAYMENT_LABELS[item.paymentMethod] || item.paymentMethod;
      if (!byPayment[label]) byPayment[label] = { count: 0, total: 0 };
      byPayment[label].count += item.qty;
      byPayment[label].total += item.totalValue;
    });

    return {
      totalQty: promoItems.reduce((s, i) => s + i.qty, 0),
      totalValue: promoItems.reduce((s, i) => s + i.totalValue, 0),
      products: Object.entries(byProduct)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.total - a.total),
      payments: Object.entries(byPayment)
        .map(([method, data]) => ({ method, ...data }))
        .sort((a, b) => b.total - a.total),
    };
  }, [filteredPOSSales, filteredOrders]);

  // Individual sales (current user only) vs store total
  const individualStats = useMemo(() => {
    if (!user) return { mySales: 0, myRevenue: 0, myTicket: 0, storeSales: 0, storeRevenue: 0, storeTicket: 0 };
    const mySales = filteredPOSSales.filter(s => s.user_id === user.id);
    const myRevenue = mySales.reduce((sum, s) => sum + s.total, 0);
    const storeSales = filteredPOSSales.length;
    const storeRevenue = filteredPOSSales.reduce((sum, s) => sum + s.total, 0);
    return {
      mySales: mySales.length,
      myRevenue,
      myTicket: mySales.length > 0 ? myRevenue / mySales.length : 0,
      storeSales,
      storeRevenue,
      storeTicket: storeSales > 0 ? storeRevenue / storeSales : 0,
    };
  }, [filteredPOSSales, user]);

  // Sales by Modality (Varejo, Atacado, Exclusivo) and Exchange metrics
  const modalityStats = useMemo(() => {
    const modalities: Record<string, { count: number; total: number }> = {
      varejo: { count: 0, total: 0 },
      atacado: { count: 0, total: 0 },
      exclusivo: { count: 0, total: 0 },
    };
    const exchanges = { count: 0, creditGenerated: 0, cashReceived: 0 };

    filteredPOSSales.forEach(sale => {
      const saleType = sale.sale_type || (sale.notes?.startsWith('TROCA') ? 'troca' : 'varejo');

      if (saleType === 'troca') {
        exchanges.count++;
        const discountAmt = Number(sale.discount_amount || 0);
        const saleTotal = Number(sale.total);
        if (saleTotal > 0) {
          exchanges.cashReceived += saleTotal;
        }
        if (discountAmt > 0 && saleTotal === 0) {
          exchanges.creditGenerated += discountAmt;
        }
      } else if (modalities[saleType]) {
        modalities[saleType].count += 1;
        modalities[saleType].total += Number(sale.total);
      } else {
        modalities.varejo.count += 1;
        modalities.varejo.total += Number(sale.total);
      }
    });

    return { modalities, exchanges };
  }, [filteredPOSSales]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle }> = {
      pending: { label: 'Pendente', variant: 'outline', icon: Clock },
      processing: { label: 'Processando', variant: 'secondary', icon: AlertCircle },
      completed: { label: 'Concluído', variant: 'default', icon: CheckCircle },
      delivered: { label: 'Entregue', variant: 'default', icon: CheckCircle },
      cancelled: { label: 'Cancelado', variant: 'destructive', icon: XCircle },
    };
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getPeriodLabel = (filter: PeriodFilter) => {
    switch (filter) {
      case 'today': return 'Hoje';
      case 'week': return 'Últimos 7 dias';
      case 'month': return 'Últimos 30 dias';
      case 'all': return 'Todo período';
      case 'custom': 
        if (customDateRange?.from) {
          const fromStr = format(customDateRange.from, 'dd/MM/yy', { locale: ptBR });
          const toStr = customDateRange.to 
            ? format(customDateRange.to, 'dd/MM/yy', { locale: ptBR })
            : fromStr;
          return customDateRange.to && customDateRange.from.getTime() !== customDateRange.to.getTime()
            ? `${fromStr} - ${toStr}`
            : fromStr;
        }
        return 'Período personalizado';
    }
  };

  const handleCustomDateSelect = (range: DateRange | undefined) => {
    setCustomDateRange(range);
    if (range?.from) {
      setPeriodFilter('custom');
      // Only close the popover when both dates are selected
      if (range.to) {
        setIsDatePickerOpen(false);
      }
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header with Period Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Olá, {profile?.full_name?.split(' ')[0] || 'Admin'}! 👋
            </h1>
            <p className="text-muted-foreground mt-1">
              Aqui está um resumo do seu painel administrativo.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Store Selector (admin only) */}
            {showStoreSelector && stores.length > 0 && (
              <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                <SelectTrigger className="w-[180px] h-9 text-xs">
                  <Store className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Todas as lojas" />
                </SelectTrigger>
                <SelectContent>
                  {isAdmin && <SelectItem value="all">Todas as lojas</SelectItem>}
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Seller Filter */}
            {sellers.length > 0 && (
              <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
                <SelectTrigger className="w-[180px] h-9 text-xs">
                  <Users className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Todos vendedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos vendedores</SelectItem>
                  {sellers.map((seller) => (
                    <SelectItem key={seller.user_id} value={seller.user_id}>{seller.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          
            {/* Period Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div className="flex bg-muted rounded-lg p-1 gap-1">
              {(['today', 'week', 'month', 'all'] as PeriodFilter[]).map((period) => (
                <Button
                  key={period}
                  variant={periodFilter === period ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setPeriodFilter(period);
                    if (period !== 'custom') {
                      setCustomDateRange(undefined);
                      setIsDatePickerOpen(false);
                    }
                  }}
                  className="text-xs px-3"
                >
                  {getPeriodLabel(period)}
                </Button>
              ))}
              
              {/* Custom Date Range Picker */}
              <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant={periodFilter === 'custom' ? 'default' : 'ghost'}
                    size="sm"
                    className={cn(
                      "text-xs px-3 gap-1",
                      periodFilter === 'custom' && "min-w-[120px]"
                    )}
                  >
                    <CalendarRange className="h-3 w-3" />
                    {periodFilter === 'custom' ? getPeriodLabel('custom') : 'Personalizado'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarComponent
                    mode="range"
                    selected={customDateRange}
                    onSelect={handleCustomDateSelect}
                    numberOfMonths={2}
                    disabled={(date) => date > new Date()}
                    className="pointer-events-auto"
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          </div>
        </div>

        {/* Sales Goals Progress */}
        {(goalProgress.daily.target > 0 || goalProgress.monthly.target > 0) && (
          <div className="grid gap-4 md:grid-cols-2">
            {/* Daily Goal */}
            {goalProgress.daily.target > 0 && (
              <Card className={cn(
                "card-elevated transition-all",
                goalProgress.daily.isComplete && "border-success/50 bg-success/5"
              )}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-3 rounded-xl",
                        goalProgress.daily.isComplete ? "bg-success/20" : "bg-primary/10"
                      )}>
                        <Target className={cn(
                          "h-6 w-6",
                          goalProgress.daily.isComplete ? "text-success" : "text-primary"
                        )} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Meta Diária</p>
                        <p className="text-2xl font-bold">{formatCurrency(goalProgress.daily.current)}</p>
                        <p className="text-[10px] text-muted-foreground">{goalProgress.daily.remainingDays} dias úteis restantes</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Meta de hoje</p>
                      <p className="text-lg font-semibold">{formatCurrency(goalProgress.daily.target)}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className={cn(
                        "font-medium",
                        goalProgress.daily.isComplete ? "text-success" : goalProgress.daily.percentage >= 70 ? "text-warning" : "text-foreground"
                      )}>
                        {goalProgress.daily.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <Progress 
                      value={goalProgress.daily.percentage} 
                      className={cn(
                        "h-3",
                        goalProgress.daily.isComplete && "[&>div]:bg-success"
                      )}
                    />
                    {goalProgress.daily.isComplete ? (
                      <p className="text-xs text-success flex items-center gap-1 mt-2">
                        <CheckCircle className="h-3 w-3" />
                        Meta alcançada! Parabéns! 🎉
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-2">
                        Faltam {formatCurrency(goalProgress.daily.target - goalProgress.daily.current)} para atingir a meta
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Monthly Goal */}
            {goalProgress.monthly.target > 0 && (
              <Card className={cn(
                "card-elevated transition-all",
                goalProgress.monthly.isComplete && "border-success/50 bg-success/5"
              )}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-3 rounded-xl",
                        goalProgress.monthly.isComplete ? "bg-success/20" : "bg-warning/10"
                      )}>
                        <TrendingUp className={cn(
                          "h-6 w-6",
                          goalProgress.monthly.isComplete ? "text-success" : "text-warning"
                        )} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Meta Mensal</p>
                        <p className="text-2xl font-bold">{formatCurrency(goalProgress.monthly.current)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Meta</p>
                      <p className="text-lg font-semibold">{formatCurrency(goalProgress.monthly.target)}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className={cn(
                        "font-medium",
                        goalProgress.monthly.isComplete ? "text-success" : goalProgress.monthly.percentage >= 70 ? "text-warning" : "text-foreground"
                      )}>
                        {goalProgress.monthly.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <Progress 
                      value={goalProgress.monthly.percentage} 
                      className={cn(
                        "h-3",
                        goalProgress.monthly.isComplete && "[&>div]:bg-success"
                      )}
                    />
                    {goalProgress.monthly.isComplete ? (
                      <p className="text-xs text-success flex items-center gap-1 mt-2">
                        <CheckCircle className="h-3 w-3" />
                        Meta alcançada! Excelente mês! 🎉
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-2">
                        Faltam {formatCurrency(goalProgress.monthly.target - goalProgress.monthly.current)} para atingir a meta
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Main Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="card-elevated">
                <CardContent className="p-6">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-20 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              {(isSiteStoreSelected || isViewingAllStores) && (
              <Card className="card-elevated">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {isSiteStoreSelected ? 'Receita Site' : 'Receita Pedidos'}
                      </p>
                      <p className="text-2xl font-bold mt-1">{formatCurrency(stats?.totalRevenue || 0)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {getPeriodLabel(periodFilter)}
                      </p>
                    </div>
                    <div className="bg-success/10 p-3 rounded-xl">
                      <DollarSign className="h-6 w-6 text-success" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              )}

              {(isSiteStoreSelected || isViewingAllStores) && (
              <Card className="card-elevated">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Pedidos</p>
                      <p className="text-2xl font-bold mt-1">{stats?.totalOrders || 0}</p>
                      <p className="text-xs text-warning mt-1">
                        {stats?.pendingOrders || 0} pendentes
                      </p>
                    </div>
                    <div className="bg-primary/10 p-3 rounded-xl">
                      <ShoppingCart className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              )}

              <Card className="card-elevated">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Produtos</p>
                      <p className="text-2xl font-bold mt-1">{stats?.activeProducts || 0}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        de {stats?.totalProducts || 0} cadastrados
                      </p>
                    </div>
                    <div className="bg-accent/10 p-3 rounded-xl">
                      <Package className="h-6 w-6 text-accent-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-elevated">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Avaliações</p>
                      <p className="text-2xl font-bold mt-1">{stats?.totalReviews || 0}</p>
                      <p className="text-xs text-warning mt-1">
                        {stats?.pendingReviews || 0} aguardando aprovação
                      </p>
                    </div>
                    <div className="bg-warning/10 p-3 rounded-xl">
                      <Star className="h-6 w-6 text-warning" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Comparison Chart - PDV vs Online - Only when viewing all stores */}
        {isViewingAllStores && (
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Comparativo: PDV vs Site
            </CardTitle>
            <CardDescription>
              Receita comparativa entre vendas no PDV e no Site - {getPeriodLabel(periodFilter)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={comparisonData} barGap={8}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(value) => `R$${value}`} />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        formatCurrency(value), 
                        name === 'site' ? 'Site' : 'PDV'
                      ]}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar 
                      dataKey="site" 
                      name="Site"
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar 
                      dataKey="pdv" 
                      name="PDV"
                      fill="hsl(var(--success))" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
                
                {/* Legend and Summary */}
                <div className="flex flex-wrap justify-center gap-6 pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-primary" />
                    <div className="text-sm">
                      <span className="text-muted-foreground">Site: </span>
                      <span className="font-semibold">{formatCurrency(stats?.totalRevenue || 0)}</span>
                      <span className="text-muted-foreground text-xs ml-1">({stats?.totalOrders || 0} pedidos)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-success" />
                    <div className="text-sm">
                      <span className="text-muted-foreground">PDV: </span>
                      <span className="font-semibold">{formatCurrency(posStats?.totalRevenue || 0)}</span>
                      <span className="text-muted-foreground text-xs ml-1">({posStats?.totalSales || 0} vendas)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-4 border-l">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Total: </span>
                      <span className="font-bold text-lg">
                        {formatCurrency((stats?.totalRevenue || 0) + (posStats?.totalRevenue || 0))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Charts Row - Site data */}
        {(isSiteStoreSelected || isViewingAllStores) && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Sales Chart */}
          <Card className="card-elevated lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Vendas Site - {getPeriodLabel(periodFilter)}
              </CardTitle>
              <CardDescription>
                Acompanhe o desempenho de vendas diário
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[250px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={salesData}>
                    <defs>
                      <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(value) => `R$${value}`} />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Receita']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="receita" 
                      stroke="hsl(var(--primary))" 
                      fillOpacity={1} 
                      fill="url(#colorReceita)" 
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Order Status Pie Chart */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Status dos Pedidos
              </CardTitle>
              <CardDescription>
                Distribuição por status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : orderStatusData.length > 0 ? (
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={orderStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {orderStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-3 justify-center mt-2">
                    {orderStatusData.map((entry, index) => (
                      <div key={index} className="flex items-center gap-1.5 text-xs">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-muted-foreground">{entry.name}: {entry.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                  Nenhum pedido registrado
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        )}

        {/* POS Sales Section - Hidden when viewing Site store */}
        {!isSiteStoreSelected && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Vendas PDV</h2>
          </div>
          
          {/* POS Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="card-elevated">
                  <CardContent className="p-6">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-20 mb-1" />
                    <Skeleton className="h-3 w-16" />
                  </CardContent>
                </Card>
              ))
            ) : (
              <>
                <Card className="card-elevated border-l-4 border-l-success">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Receita PDV</p>
                        <p className="text-2xl font-bold mt-1">{formatCurrency(posStats?.totalRevenue || 0)}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {getPeriodLabel(periodFilter)}
                        </p>
                      </div>
                      <div className="bg-success/10 p-3 rounded-xl">
                        <DollarSign className="h-6 w-6 text-success" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-elevated border-l-4 border-l-primary">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Vendas PDV</p>
                        <p className="text-2xl font-bold mt-1">{posStats?.totalSales || 0}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {getPeriodLabel(periodFilter)}
                        </p>
                      </div>
                      <div className="bg-primary/10 p-3 rounded-xl">
                        <Store className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-elevated border-l-4 border-l-warning">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Ticket Médio</p>
                        <p className="text-2xl font-bold mt-1">{formatCurrency(posStats?.averageTicket || 0)}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Por venda no PDV
                        </p>
                      </div>
                      <div className="bg-warning/10 p-3 rounded-xl">
                        <TrendingUp className="h-6 w-6 text-warning" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-elevated border-l-4 border-l-primary">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Ticket Médio por Produto</p>
                        <p className="text-2xl font-bold mt-1">{formatCurrency(posStats?.averageProductTicket || 0)}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {posStats?.totalItemsSold || 0} itens vendidos
                        </p>
                      </div>
                      <div className="bg-primary/10 p-3 rounded-xl">
                        <Package className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-elevated border-l-4 border-l-destructive">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Descontos</p>
                        <p className="text-2xl font-bold mt-1">{formatCurrency(posStats?.totalDiscount || 0)}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {getPeriodLabel(periodFilter)}
                        </p>
                      </div>
                      <div className="bg-destructive/10 p-3 rounded-xl">
                        <Percent className="h-6 w-6 text-destructive" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Individual vs Store Sales */}
          {!isLoading && selectedSellerId === 'all' && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="card-elevated border-l-4 border-l-primary">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Minhas Vendas</p>
                      <p className="text-2xl font-bold mt-1">{formatCurrency(individualStats.myRevenue)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {individualStats.mySales} vendas • Ticket: {formatCurrency(individualStats.myTicket)}
                      </p>
                    </div>
                    <div className="bg-primary/10 p-3 rounded-xl">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-elevated border-l-4 border-l-success">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total da Loja</p>
                      <p className="text-2xl font-bold mt-1">{formatCurrency(individualStats.storeRevenue)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {individualStats.storeSales} vendas • Ticket: {formatCurrency(individualStats.storeTicket)}
                      </p>
                    </div>
                    <div className="bg-success/10 p-3 rounded-xl">
                      <Store className="h-6 w-6 text-success" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* POS Charts and Details */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* POS Sales Chart */}
            <Card className="card-elevated lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5 text-primary" />
                  Vendas PDV - Últimos 7 Dias
                </CardTitle>
                <CardDescription>
                  Acompanhe o desempenho das vendas da loja física
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[250px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={posSalesData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={(value) => `R$${value}`} />
                      <Tooltip 
                        formatter={(value: number, name: string) => [
                          name === 'receita' ? formatCurrency(value) : value, 
                          name === 'receita' ? 'Receita' : 'Vendas'
                        ]}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Bar dataKey="receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Payment Methods Pie Chart */}
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Formas de Pagamento
                </CardTitle>
                <CardDescription>
                  Distribuição por tipo de pagamento
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[280px] w-full" />
                ) : posStats && posStats.totalSales > 0 ? (
                  <div className="space-y-4">
                    {/* Pie Chart */}
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Dinheiro', value: posStats.paymentMethods.cash.total, color: 'hsl(142, 76%, 36%)' },
                            { name: 'Crédito', value: posStats.paymentMethods.card.credit > 0 ? (posStats.paymentMethods.card.total * posStats.paymentMethods.card.credit / posStats.paymentMethods.card.count) || 0 : 0, color: 'hsl(221, 83%, 53%)' },
                            { name: 'Débito', value: posStats.paymentMethods.card.debit > 0 ? (posStats.paymentMethods.card.total * posStats.paymentMethods.card.debit / posStats.paymentMethods.card.count) || 0 : 0, color: 'hsl(199, 89%, 48%)' },
                            { name: 'PIX', value: posStats.paymentMethods.pix.total, color: 'hsl(172, 66%, 50%)' },
                            { name: 'Misto', value: posStats.paymentMethods.mixed.total, color: 'hsl(271, 91%, 65%)' },
                          ].filter(d => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={75}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {[
                            { name: 'Dinheiro', value: posStats.paymentMethods.cash.total, color: 'hsl(142, 76%, 36%)' },
                            { name: 'Crédito', value: posStats.paymentMethods.card.credit > 0 ? (posStats.paymentMethods.card.total * posStats.paymentMethods.card.credit / posStats.paymentMethods.card.count) || 0 : 0, color: 'hsl(221, 83%, 53%)' },
                            { name: 'Débito', value: posStats.paymentMethods.card.debit > 0 ? (posStats.paymentMethods.card.total * posStats.paymentMethods.card.debit / posStats.paymentMethods.card.count) || 0 : 0, color: 'hsl(199, 89%, 48%)' },
                            { name: 'PIX', value: posStats.paymentMethods.pix.total, color: 'hsl(172, 66%, 50%)' },
                            { name: 'Misto', value: posStats.paymentMethods.mixed.total, color: 'hsl(271, 91%, 65%)' },
                          ].filter(d => d.value > 0).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    
                    {/* Legend with details */}
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(142, 76%, 36%)' }} />
                          <span className="text-muted-foreground">Dinheiro</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{posStats.paymentMethods.cash.count}x</span>
                          <span className="font-medium">{formatCurrency(posStats.paymentMethods.cash.total)}</span>
                        </div>
                      </div>
                      
                      {posStats.paymentMethods.card.credit > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(221, 83%, 53%)' }} />
                            <span className="text-muted-foreground">Crédito</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{posStats.paymentMethods.card.credit}x</span>
                            <span className="font-medium">{formatCurrency((posStats.paymentMethods.card.total * posStats.paymentMethods.card.credit / posStats.paymentMethods.card.count) || 0)}</span>
                          </div>
                        </div>
                      )}
                      
                      {posStats.paymentMethods.card.debit > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(199, 89%, 48%)' }} />
                            <span className="text-muted-foreground">Débito</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{posStats.paymentMethods.card.debit}x</span>
                            <span className="font-medium">{formatCurrency((posStats.paymentMethods.card.total * posStats.paymentMethods.card.debit / posStats.paymentMethods.card.count) || 0)}</span>
                          </div>
                        </div>
                      )}
                      
                      {posStats.paymentMethods.pix.count > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(172, 66%, 50%)' }} />
                            <span className="text-muted-foreground">PIX</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{posStats.paymentMethods.pix.count}x</span>
                            <span className="font-medium">{formatCurrency(posStats.paymentMethods.pix.total)}</span>
                          </div>
                        </div>
                      )}
                      
                      {posStats.paymentMethods.mixed.count > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(271, 91%, 65%)' }} />
                            <span className="text-muted-foreground">Misto</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{posStats.paymentMethods.mixed.count}x</span>
                            <span className="font-medium">{formatCurrency(posStats.paymentMethods.mixed.total)}</span>
                          </div>
                        </div>
                      )}
                      
                      {posStats.installmentSales > 0 && (
                        <div className="pt-2 mt-2 border-t">
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{posStats.installmentSales}</span> vendas parceladas no crédito
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                    Nenhuma venda registrada
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent POS Sales */}
          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Vendas Recentes no PDV
                </CardTitle>
                <CardDescription>
                  Últimas vendas realizadas na loja física
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Link 
                  to="/admin/sales" 
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  Ver todas <ArrowUpRight className="h-3 w-3" />
                </Link>
                <Link 
                  to="/admin/pos" 
                  className="text-sm text-muted-foreground hover:text-primary hover:underline flex items-center gap-1"
                >
                  Ir para PDV <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-6 w-20" />
                    </div>
                  ))}
                </div>
              ) : recentPOSSales.length > 0 ? (
                <div className="space-y-3">
                  {recentPOSSales.map((sale) => {
                    const paymentDetails = sale.payment_details;
                    const cardType = paymentDetails?.cardType as string | undefined;
                    const installments = paymentDetails?.installments as number | undefined;
                    
                    return (
                      <div key={sale.id} className="flex items-center justify-between py-3 border-b last:border-0">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            sale.payment_method === 'cash' ? 'bg-green-500/10' :
                            sale.payment_method === 'card' ? 'bg-blue-500/10' :
                            sale.payment_method === 'pix' ? 'bg-teal-500/10' : 'bg-purple-500/10'
                          }`}>
                            {sale.payment_method === 'cash' && <Banknote className="h-4 w-4 text-green-600" />}
                            {sale.payment_method === 'card' && <CreditCard className="h-4 w-4 text-blue-600" />}
                            {sale.payment_method === 'pix' && <QrCode className="h-4 w-4 text-teal-600" />}
                            {sale.payment_method === 'mixed' && <DollarSign className="h-4 w-4 text-purple-600" />}
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {sale.customer_name || 'Cliente não identificado'}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{new Date(sale.created_at).toLocaleString('pt-BR', { 
                                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
                              })}</span>
                              {sale.payment_method === 'card' && cardType && (
                                <Badge variant="outline" className="text-xs py-0">
                                  {cardType === 'credit' ? 'Crédito' : 'Débito'}
                                  {installments && installments > 1 && ` ${installments}x`}
                                </Badge>
                              )}
                              {sale.discount_amount && sale.discount_amount > 0 && (
                                <Badge variant="secondary" className="text-xs py-0">
                                  -{formatCurrency(sale.discount_amount)}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <p className="font-semibold">{formatCurrency(sale.total)}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  Nenhuma venda no PDV ainda
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        )}

        {/* Promotional Sales Section */}
        {promotionalStats.totalQty > 0 && (
          <Card className="card-elevated border-l-4 border-l-warning">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-warning" />
                Vendas Promocionais
              </CardTitle>
              <CardDescription>
                Produtos vendidos com preço promocional — {getPeriodLabel(periodFilter)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Summary KPIs */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-warning/5 rounded-lg border border-warning/20">
                    <div>
                      <p className="text-sm text-muted-foreground">Itens vendidos</p>
                      <p className="text-2xl font-bold">{promotionalStats.totalQty}</p>
                    </div>
                    <Package className="h-8 w-8 text-warning/60" />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-success/5 rounded-lg border border-success/20">
                    <div>
                      <p className="text-sm text-muted-foreground">Valor total</p>
                      <p className="text-2xl font-bold">{formatCurrency(promotionalStats.totalValue)}</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-success/60" />
                  </div>
                </div>

                {/* Products breakdown */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Produtos</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {promotionalStats.products.slice(0, 10).map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.qty} un.</p>
                        </div>
                        <span className="font-semibold ml-2 shrink-0">{formatCurrency(p.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment methods breakdown */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Formas de Pagamento</h4>
                  <div className="space-y-2">
                    {promotionalStats.payments.map((pm, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <span>{pm.method}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold">{formatCurrency(pm.total)}</span>
                          <span className="text-xs text-muted-foreground ml-1">({pm.count}x)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sales by Modality & Exchange Metrics */}
        {!isSiteStoreSelected && (
          <Card className="card-elevated border-l-4 border-l-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />
                Vendas por Modalidade
              </CardTitle>
              <CardDescription>
                Desempenho por tipo de venda — {getPeriodLabel(periodFilter)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Varejo */}
                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <ShoppingCart className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Varejo</span>
                  </div>
                  <p className="text-2xl font-bold">{formatCurrency(modalityStats.modalities.varejo.total)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {modalityStats.modalities.varejo.count} vendas • Ticket: {formatCurrency(modalityStats.modalities.varejo.count > 0 ? modalityStats.modalities.varejo.total / modalityStats.modalities.varejo.count : 0)}
                  </p>
                </div>

                {/* Atacado */}
                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-4 w-4 text-success" />
                    <span className="text-sm font-medium">Atacado</span>
                  </div>
                  <p className="text-2xl font-bold">{formatCurrency(modalityStats.modalities.atacado.total)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {modalityStats.modalities.atacado.count} vendas • Ticket: {formatCurrency(modalityStats.modalities.atacado.count > 0 ? modalityStats.modalities.atacado.total / modalityStats.modalities.atacado.count : 0)}
                  </p>
                </div>

                {/* Exclusivo */}
                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="h-4 w-4 text-warning" />
                    <span className="text-sm font-medium">Exclusivo</span>
                  </div>
                  <p className="text-2xl font-bold">{formatCurrency(modalityStats.modalities.exclusivo.total)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {modalityStats.modalities.exclusivo.count} vendas • Ticket: {formatCurrency(modalityStats.modalities.exclusivo.count > 0 ? modalityStats.modalities.exclusivo.total / modalityStats.modalities.exclusivo.count : 0)}
                  </p>
                </div>

                {/* Trocas */}
                <div className="p-4 rounded-lg border bg-card border-destructive/30">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowDownRight className="h-4 w-4 text-destructive" />
                    <span className="text-sm font-medium">Trocas</span>
                  </div>
                  <p className="text-2xl font-bold">{modalityStats.exchanges.count}</p>
                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    <p>Crédito gerado: {formatCurrency(modalityStats.exchanges.creditGenerated)}</p>
                    <p>Diferença recebida: {formatCurrency(modalityStats.exchanges.cashReceived)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sales by Region Map - All stores */}
        <BrazilSalesMap salesByState={salesByState} isLoading={isLoading} />

        {/* Bottom Row */}
        <div className={cn("grid gap-6", (isSiteStoreSelected || isViewingAllStores) ? "lg:grid-cols-2" : "lg:grid-cols-1")}>
          {/* Recent Orders - Site only */}
          {(isSiteStoreSelected || isViewingAllStores) && (
          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Pedidos Recentes
                </CardTitle>
                <CardDescription>
                  Últimos pedidos realizados
                </CardDescription>
              </div>
              <Link 
                to="/admin/orders" 
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                Ver todos <ArrowUpRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-6 w-20" />
                    </div>
                  ))}
                </div>
              ) : recentOrders.length > 0 ? (
                <div className="space-y-4">
                  {recentOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium text-sm">
                          {order.customer_name || order.customer_email.split('@')[0]}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(Number(order.total))} • {new Date(order.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      {getStatusBadge(order.status)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  Nenhum pedido encontrado
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* WhatsApp Metrics - Site only */}
          {(isSiteStoreSelected || isViewingAllStores) && <WhatsAppMetrics />}

          {/* Quick Actions */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Ações Rápidas
              </CardTitle>
              <CardDescription>
                Acesse rapidamente as principais áreas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <Link 
                  to="/admin/products" 
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Produtos</p>
                    <p className="text-xs text-muted-foreground">{stats?.activeProducts || 0} ativos</p>
                  </div>
                </Link>

                <Link 
                  to="/admin/orders" 
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="bg-warning/10 p-2 rounded-lg">
                    <ShoppingCart className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Pedidos</p>
                    <p className="text-xs text-muted-foreground">{stats?.pendingOrders || 0} pendentes</p>
                  </div>
                </Link>

                <Link 
                  to="/admin/reviews" 
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="bg-accent/10 p-2 rounded-lg">
                    <Star className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Avaliações</p>
                    <p className="text-xs text-muted-foreground">{stats?.pendingReviews || 0} pendentes</p>
                  </div>
                </Link>

                <Link 
                  to="/admin/coupons" 
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="bg-success/10 p-2 rounded-lg">
                    <Tag className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Cupons</p>
                    <p className="text-xs text-muted-foreground">{stats?.activeCoupons || 0} ativos</p>
                  </div>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Role Info */}
        {roles.length > 0 && (
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Suas Permissões
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {roles.map((role) => (
                  <span
                    key={role}
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary capitalize"
                  >
                    {role}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default Dashboard;
