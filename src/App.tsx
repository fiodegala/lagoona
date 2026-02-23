import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { CartProvider } from "./contexts/CartContext";
import { FavoritesProvider } from "./contexts/FavoritesContext";
import ProtectedRoute from "./components/ProtectedRoute";

// Admin Pages
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Categories from "./pages/Categories";
import Orders from "./pages/Orders";
import Reports from "./pages/Reports";
import UsersPage from "./pages/Users";
import Settings from "./pages/Settings";
import ApiKeys from "./pages/ApiKeys";
import ApiDocs from "./pages/ApiDocs";
import Reviews from "./pages/Reviews";
import Coupons from "./pages/Coupons";
import NotFound from "./pages/NotFound";
import ProductDetails from "./pages/ProductDetails";
import POSPage from "./pages/POSPage";
import Customers from "./pages/Customers";
import Stock from "./pages/Stock";
import Shipping from "./pages/Shipping";

// Store Pages
import HomePage from "./pages/store/HomePage";
import StorePage from "./pages/store/StorePage";
import CategoryPage from "./pages/store/CategoryPage";
import CartPage from "./pages/store/CartPage";
import CheckoutPage from "./pages/store/CheckoutPage";
import AboutPage from "./pages/store/AboutPage";
import ContactPage from "./pages/store/ContactPage";
import FaqPage from "./pages/store/FaqPage";
import PrivacyPolicyPage from "./pages/store/PrivacyPolicyPage";
import TermsPage from "./pages/store/TermsPage";
import ExchangesReturnsPage from "./pages/store/ExchangesReturnsPage";
import FavoritesPage from "./pages/store/FavoritesPage";
import OrderTrackingPage from "./pages/store/OrderTrackingPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CartProvider>
        <FavoritesProvider>
          <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public Store Routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/loja" element={<StorePage />} />
              <Route path="/loja/categoria/:slug" element={<CategoryPage />} />
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
                  <ProtectedRoute>
                    <Products />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/categories"
                element={
                  <ProtectedRoute>
                    <Categories />
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
                path="/admin/reviews"
                element={
                  <ProtectedRoute>
                    <Reviews />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/coupons"
                element={
                  <ProtectedRoute>
                    <Coupons />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/shipping"
                element={
                  <ProtectedRoute>
                    <Shipping />
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
                path="/admin/users"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <UsersPage />
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
          </BrowserRouter>
          </TooltipProvider>
        </FavoritesProvider>
      </CartProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
