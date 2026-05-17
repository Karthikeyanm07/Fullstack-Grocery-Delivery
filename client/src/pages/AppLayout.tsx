import { Outlet } from "react-router-dom";
import Banner from "../components/Banner.tsx";
import Navbar from "../components/Navbar.tsx";
import Footer from "../components/Footer.tsx";
import CartSidebar from "../components/CartSidebar.tsx";

const AppLayout = () => {
	return (
		<>
			<Banner />
			<Navbar />
			<main className="min-h-screen">
				<Outlet />
			</main>
			<Footer />
			<CartSidebar />
		</>
	);
};

export default AppLayout;
