import { Navigate, Outlet } from "react-router-dom";
import Loading from "./Loading";
import { useDeliveryAuth } from "../context/DeliveryAuthContext";

const DeliveryProtectedRoute = () => {
	const { partner, loading } = useDeliveryAuth();

	if (loading) {
		return <Loading />;
	}

	if (!partner) {
		return <Navigate to="/delivery/login" replace />;
	}

	return <Outlet />;
};

export default DeliveryProtectedRoute;
