import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../config/api";
import type { DeliveryPartner } from "../types";
import { getApiErrorMessage } from "../utils/apiError";

interface DeliveryAuthContextType {
	partner: DeliveryPartner | null;
	loading: boolean;
	login: (email: string, password: string) => Promise<void>;
	logout: () => Promise<void>;
}

const DeliveryAuthContext = createContext<DeliveryAuthContextType | undefined>(
	undefined,
);

export function DeliveryAuthProvider({ children }: { children: ReactNode }) {
	const navigate = useNavigate();
	const [partner, setPartner] = useState<DeliveryPartner | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const savedPartner = localStorage.getItem("delivery_partner");
		if (savedPartner) {
			try {
				setPartner(JSON.parse(savedPartner));
			} catch (_error) {
				localStorage.removeItem("delivery_partner");
			}
		}
		setLoading(false);
	}, []);

	const handleSessionExpired = useCallback(() => {
		setPartner(null);
		localStorage.removeItem("delivery_partner");
		navigate("/delivery/login");
	}, [navigate]);

	useEffect(() => {
		window.addEventListener("delivery:logout", handleSessionExpired);
		return () =>
			window.removeEventListener("delivery:logout", handleSessionExpired);
	}, [handleSessionExpired]);

	const login = async (email: string, password: string) => {
		try {
			const { partner: partnerData } = await api.post("/delivery/login", {
				email,
				password,
			});
			setPartner(partnerData);
			localStorage.setItem("delivery_partner", JSON.stringify(partnerData));
			toast.success("Delivery login successful.");
			navigate("/delivery");
		} catch (error) {
			toast.error(
				getApiErrorMessage(error, "Delivery login failed. Please try again."),
			);
			throw error;
		}
	};

	const logout = async () => {
		try {
			await api.post("/delivery/logout");
		} catch (_error) {
		} finally {
			setPartner(null);
			localStorage.removeItem("delivery_partner");
			navigate("/delivery/login");
		}
	};

	return (
		<DeliveryAuthContext.Provider value={{ partner, loading, login, logout }}>
			{children}
		</DeliveryAuthContext.Provider>
	);
}

export function useDeliveryAuth() {
	const context = useContext(DeliveryAuthContext);
	if (!context) {
		throw new Error("useDeliveryAuth must be used within DeliveryAuthProvider");
	}
	return context;
}
