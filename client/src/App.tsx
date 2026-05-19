import { Toaster } from "react-hot-toast";
import { Route, Routes } from "react-router-dom";
import Login from "./pages/Login.tsx";
import AppLayout from "./pages/AppLayout.tsx";
import Home from "./pages/Home.tsx";
import Products from "./pages/Products.tsx";
import ProductPage from "./pages/ProductPage.tsx";
import SearchResults from "./pages/SearchResults.tsx";
import FlashDeals from "./pages/FlashDeals.tsx";
import Checkout from "./pages/Checkout.tsx";
import MyOrders from "./pages/MyOrders.tsx";
import Addresses from "./pages/Addresses.tsx";
import OrderTracking from "./pages/OrderTracking.tsx";
import ProtectedRoute from "./components/ProtectedRoute.tsx";
import AdminLayout from "./pages/admin/AdminLayout.tsx";
import AdminDashboard from "./pages/admin/AdminDashboard.tsx";
import AdminProducts from "./pages/admin/AdminProducts.tsx";
import AdminProductForm from "./pages/admin/AdminProductForm.tsx";
import AdminOrders from "./pages/admin/AdminOrders.tsx";
import AdminDeliveryPartners from "./pages/admin/AdminDeliveryPartners.tsx";
import DeliveryLogin from "./pages/delivery/DeliveryLogin.tsx";
import DeliveryLayout from "./pages/delivery/DeliveryLayout.tsx";
import DeliveryDashboard from "./pages/delivery/DeliveryDashboard.tsx";

const App = () => {
	return (
		<>
			<Toaster
				position="top-right"
				toastOptions={{
					duration: 3000,
					style: {
						background: "#1B3022",
						color: "#fff",
						borderRadius: "12px",
						fontSize: "14px",
					},
				}}
			/>
			<Routes>
				{/* Auth pages (No -> Navbar/Footer) */}
				<Route path="/login" element={<Login />} />

				{/* Main Pages */}
				<Route path="/" element={<AppLayout />}>
					{/* Unprotected */}
					<Route index element={<Home />} />
					<Route path="/products" element={<Products />} />
					<Route path="/products/:id" element={<ProductPage />} />
					<Route path="/search" element={<SearchResults />} />
					<Route path="/deals" element={<FlashDeals />} />
					{/* Protected Routes */}
					<Route element={<ProtectedRoute />}>
						<Route path="/checkout" element={<Checkout />} />
						<Route path="/orders" element={<MyOrders />} />
						<Route path="/orders/:id" element={<OrderTracking />} />
						<Route path="/addresses" element={<Addresses />} />
					</Route>
				</Route>

				{/* Admin Pages */}
				<Route path="/admin" element={<AdminLayout />}>
					<Route index element={<AdminDashboard />} />
					<Route path="products" element={<AdminProducts />} />
					<Route path="products/new" element={<AdminProductForm />} />
					<Route path="products/:id/edit" element={<AdminProductForm />} />
					<Route path="orders" element={<AdminOrders />} />
					<Route path="delivery-partners" element={<AdminDeliveryPartners />} />
				</Route>

				{/* Delivery Partner pages */}
				<Route path="/delivery/login" element={<DeliveryLogin />} />
				<Route path="/delivery" element={<DeliveryLayout />}>
					<Route index element={<DeliveryDashboard />} />
				</Route>
			</Routes>
		</>
	);
};

export default App;
