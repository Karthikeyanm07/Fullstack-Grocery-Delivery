import {
	createContext,
	useContext,
	type ReactNode,
	useState,
	useEffect,
	useCallback,
} from "react";
import type { User } from "../types";
import { useNavigate } from "react-router-dom";
import api from "../config/api";
import toast from "react-hot-toast";

interface AuthContextType {
	user: User | null;
	loading: boolean;
	login: (email: string, password: string) => Promise<void>;
	register: (name: string, email: string, password: string) => Promise<void>;
	logout: () => void;
	updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
	const navigate = useNavigate();
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const savedUser = localStorage.getItem("auth_user");

		if (savedUser) {
			try {
				setUser(JSON.parse(savedUser));
			} catch (error) {
				localStorage.removeItem("auth_user");
			}
		}

		setLoading(false);
	}, []);

	const handleSessionExpired = useCallback(() => {
		setUser(null);
		localStorage.removeItem("auth_user");
		navigate("/login");
	}, [navigate]);

	useEffect(() => {
		window.addEventListener("auth:logout", handleSessionExpired);
		return () =>
			window.removeEventListener("auth:logout", handleSessionExpired);
	}, [handleSessionExpired]);

	// * ── Login ─────────────────────────────────────────────────────────────────
	const login = async (email: string, password: string) => {
		try {
			const { user: userData } = await api.post("/auth/login", { email, password });

			setUser(userData);
			localStorage.setItem("auth_user", JSON.stringify(userData));
			toast.success("Login Successful.");

			navigate("/");
		} catch (error: any) {
			toast.error(
				error.response?.data?.message ??
					"Login failed. Please try again.",
			);
		}
	};

	// * ── Register ────────────────────────────────────────────────────────────────
	const register = async (name: string, email: string, password: string) => {
		try {
			const { user: userData } = await api.post("/auth/register", {
				name,
				email,
				password,
			});

			setUser(userData);
			localStorage.setItem("auth_user", JSON.stringify(userData));
			toast.success("Registration Successful.");

			navigate("/");
		} catch (error: any) {
			toast.error(
				error.response?.data?.message ??
					"Registration failed. Please try again.",
			);
		}
	};

	// * ── Logout ────────────────────────────────────────────────────────────────
	const logout = async () => {
		try {
			await api.post("/auth/logout");
		} catch (error) {
		} finally {
			setUser(null);
			localStorage.removeItem("auth_user");
			navigate("/login");
		}
	};

	// * ── Update user ───────────────────────────────────────────────────────────
	const updateUser = (userdata: Partial<User>) => {
		if (user) {
			const updated = { ...user, ...userdata };
			setUser(updated);
			localStorage.setItem("auth_user", JSON.stringify(updated));
		}
	};
	return (
		<AuthContext.Provider
			value={{
				user,
				loading,
				login,
				register,
				logout,
				updateUser,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth(): AuthContextType {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within Auth Provider");
	}

	return context;
}
