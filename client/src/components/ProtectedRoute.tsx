import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Loading from "./Loading";

interface ProtectedRouteProps {
	requireAdmin?: boolean;
}

const ProtectedRoute = ({ requireAdmin = false }: ProtectedRouteProps) => {
	const { user, loading } = useAuth();

	if (loading) {
		return <Loading />;
	}
	if (!user) {
		return <Navigate to="/login" replace />;
	}
	if (requireAdmin && !user.isAdmin) {
		return <Navigate to="/" replace />;
	}
	return <Outlet />;
};

export default ProtectedRoute;
