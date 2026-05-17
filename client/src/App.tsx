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
			</Routes>
		</>
	);
};

export default App;
