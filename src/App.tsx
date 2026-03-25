import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { CartProvider } from "./contexts/CartContext";
import { FavoritesProvider } from "./contexts/FavoritesContext";
import ProtectedRoute from "./components/ProtectedRoute";
import ScrollToTop from "./components/ScrollToTop";
import { Loader2 } from "lucide-react";

// Lazy-loaded Admin Pages
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Products = lazy(() => import("./pages/Products"));
const Categories = lazy(() => import("./pages/Categories"));
const Orders = lazy(() => import("./pages/Orders"));
const Reports = lazy(() => import("./pages/Reports"));
const UsersPage = lazy(() => import("./pages/Users"));
const Settings = lazy(() => import("./pages/Settings"));
const ApiKeys = lazy(() => import("./pages/ApiKeys"));
const ApiDocs = lazy(() => import("./pages/ApiDocs"));
const Reviews = lazy(() => import("./pages/Reviews"));
const Coupons = lazy(() => import("./pages/Coupons"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ProductDetails = lazy(() => import("./pages/ProductDetails"));
const POSPage = lazy(() => import("./pages/POSPage"));
const AbandonedCarts = lazy(() => import("./pages/AbandonedCarts"));
const Customers = lazy(() => import("./pages/Customers"));
const Stock = lazy(() => import("./pages/Stock"));
const Shipping = lazy(() => import("./pages/Shipping"));
const Banners = lazy(() => import("./pages/Banners"));
const Sales = lazy(() => import("./pages/Sales"));
const LegacyImport = lazy(() => import("./pages/LegacyImport"));
const ImportCSVProducts = lazy(() => import("./pages/ImportCSVProducts"));
const Combos = lazy(() => import("./pages/Combos"));
const Analytics = lazy(() => import("./pages/Analytics"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const Upsells = lazy(() => import("./pages/Upsells"));
const AdminAssistant = lazy(() => import("./pages/AdminAssistant"));
const Quotes = lazy(() => import("./pages/Quotes"));
const Affiliates = lazy(() => import("./pages/Affiliates"));
const DataImport = lazy(() => import("./pages/DataImport"));
const Manual = lazy(() => import("./pages/Manual"));
const ProductPricing = lazy(() => import("./pages/ProductPricing"));
const ServiceOrders = lazy(() => import("./pages/ServiceOrders"));
const AdminAnnouncements = lazy(() => import("./pages/AdminAnnouncements"));
const OlistIntegration = lazy(() => import("./pages/OlistIntegration"));

// Lazy-loaded Store Pages
const HomePage = lazy(() => import("./pages/store/HomePage"));
const StorePage = lazy(() => import("./pages/store/StorePage"));
const CategoryPage = lazy(() => import("./pages/store/CategoryPage"));
const CategoriesPage = lazy(() => import("./pages/store/CategoriesPage"));
const CartPage = lazy(() => import("./pages/store/CartPage"));
const CheckoutPage = lazy(() => import("./pages/store/CheckoutPage"));
const AboutPage = lazy(() => import("./pages/store/AboutPage"));
const ContactPage = lazy(() => import("./pages/store/ContactPage"));
const FaqPage = lazy(() => import("./pages/store/FaqPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/store/PrivacyPolicyPage"));
const TermsPage = lazy(() => import("./pages/store/TermsPage"));
const ExchangesReturnsPage = lazy(() => import("./pages/store/ExchangesReturnsPage"));
const FavoritesPage = lazy(() => import("./pages/store/FavoritesPage"));
const OrderTrackingPage = lazy(() => import("./pages/store/OrderTrackingPage"));
const StoreLoginPage = lazy(() => import("./pages/store/StoreLoginPage"));
const MyAccountPage = lazy(() => import("./pages/store/MyAccountPage"));
const WholesalePage = lazy(() => import("./pages/store/WholesalePage"));
const WorkWithUsPage = lazy(() => import("./pages/store/WorkWithUsPage"));
const CombosPage = lazy(() => import("./pages/store/CombosPage"));
const QuoteViewPage = lazy(() => import("./pages/store/QuoteViewPage"));
const CatalogPage = lazy(() => import("./pages/store/CatalogPage"));
const ResellerCatalogPage = lazy(() => import("./pages/store/ResellerCatalogPage"));
const AffiliateSignupPage = lazy(() => import("./pages/store/AffiliateSignupPage"));
const AffiliateDashboardPage = lazy(() => import("./pages/store/AffiliateDashboardPage"));
const AffiliateRedirectPage = lazy(() => import("./pages/store/AffiliateRedirectPage"));
const ApiImportDocsPage = lazy(() => import("./pages/store/ApiImportDocsPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 min
      gcTime: 1000 * 60 * 5, // 5 min (previously cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CartProvider>
        <FavoritesProvider>
          <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public Store Routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/loja" element={<StorePage />} />
              <Route path="/loja/categoria/:slug" element={<CategoryPage />} />
              <Route path="/categorias" element={<CategoriesPage />} />
              <Route path="/carrinho" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/produto/:id" element={<ProductDetails />} />
              <Route path="/sobre" element={<AboutPage />} />
              <Route path="/contato" element={<ContactPage />} />
              <Route path="/faq" element={<FaqPage />} />
              <Route path="/privacidade" element={<PrivacyPolicyPage />} />
              <Route path="/termos" element={<TermsPage />} />
              <Route path="/trocas-devolucoes" element={<ExchangesReturnsPage />} />
              <Route path="/favoritos" element={<FavoritesPage />} />
              <Route path="/rastrear-pedido" element={<OrderTrackingPage />} />
              <Route path="/conta/login" element={<StoreLoginPage />} />
              <Route path="/minha-conta" element={<MyAccountPage />} />
              <Route path="/atacado" element={<WholesalePage />} />
              <Route path="/combos" element={<CombosPage />} />
              <Route path="/trabalhe-conosco" element={<WorkWithUsPage />} />
              <Route path="/orcamento/:id" element={<QuoteViewPage />} />
              <Route path="/catalogo" element={<CatalogPage />} />
              <Route path="/catalogo-revendedor" element={<ResellerCatalogPage />} />
              <Route path="/afiliados" element={<AffiliateSignupPage />} />
              <Route path="/afiliados/painel" element={<AffiliateDashboardPage />} />
              <Route path="/r/:code" element={<AffiliateRedirectPage />} />
              <Route path="/docs/api-import" element={<ApiImportDocsPage />} />

              {/* Admin Routes */}
              <Route path="/login" element={<Login />} />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/pos"
                element={
                  <ProtectedRoute>
                    <POSPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/products"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <Products />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/valores-produtos"
                element={
                  <ProtectedRoute>
                    <ProductPricing />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/categories"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <Categories />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/abandoned-carts"
                element={
                  <ProtectedRoute>
                    <AbandonedCarts />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/stock"
                element={
                  <ProtectedRoute>
                    <Stock />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/customers"
                element={
                  <ProtectedRoute>
                    <Customers />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/orders"
                element={
                  <ProtectedRoute>
                    <Orders />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/sales"
                element={
                  <ProtectedRoute>
                    <Sales />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/reviews"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <Reviews />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/coupons"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <Coupons />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/combos"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <Combos />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/shipping"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <Shipping />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/banners"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <Banners />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/reports"
                element={
                  <ProtectedRoute>
                    <Reports />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/analytics"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <Analytics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <UsersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/audit-logs"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <AuditLogs />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/settings/api-keys"
                element={
                  <ProtectedRoute requiredRole="manager">
                    <ApiKeys />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/settings/api-docs"
                element={
                  <ProtectedRoute requiredRole="manager">
                    <ApiDocs />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/upsells"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <Upsells />
                  </ProtectedRoute>
                }
              />

              {/* Legacy import route */}
              <Route
                path="/admin/importar-legado"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <LegacyImport />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/importar-csv"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <ImportCSVProducts />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/assistente"
                element={
                  <ProtectedRoute requiredRole="manager">
                    <AdminAssistant />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/orcamentos"
                element={
                  <ProtectedRoute>
                    <Quotes />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/afiliados"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <Affiliates />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/importar-dados"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <DataImport />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/manual"
                element={
                  <ProtectedRoute>
                    <Manual />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/ordens-servico"
                element={
                  <ProtectedRoute>
                    <ServiceOrders />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/comunicados"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminAnnouncements />
                  </ProtectedRoute>
                }
                />
              />

              <Route
                path="/admin/olist"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <OlistIntegration />
                  </ProtectedRoute>
                }

              {/* Legacy redirects for admin routes */}
              <Route path="/products" element={<Navigate to="/admin/products" replace />} />
              <Route path="/categories" element={<Navigate to="/admin/categories" replace />} />
              <Route path="/orders" element={<Navigate to="/admin/orders" replace />} />
              <Route path="/reports" element={<Navigate to="/admin/reports" replace />} />
              <Route path="/users" element={<Navigate to="/admin/users" replace />} />
              <Route path="/settings" element={<Navigate to="/admin/settings" replace />} />
              <Route path="/settings/api-keys" element={<Navigate to="/admin/settings/api-keys" replace />} />
              <Route path="/settings/api-docs" element={<Navigate to="/admin/settings/api-docs" replace />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </BrowserRouter>
          </TooltipProvider>
        </FavoritesProvider>
      </CartProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
