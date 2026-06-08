import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router-dom";
import { CartProvider } from "./context/CartContext.tsx";
import { AuthProvider } from "./context/AuthContext.tsx";
import { DeliveryAuthProvider } from "./context/DeliveryAuthContext.tsx";

createRoot(document.getElementById("root")!).render(
	<BrowserRouter>
		<AuthProvider>
			<DeliveryAuthProvider>
				<CartProvider>
					<App />
				</CartProvider>
			</DeliveryAuthProvider>
		</AuthProvider>
	</BrowserRouter>,
);
