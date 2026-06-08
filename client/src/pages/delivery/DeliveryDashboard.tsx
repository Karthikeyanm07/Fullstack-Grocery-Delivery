import { useEffect, useState } from "react";
import { PackageIcon, NavigationIcon } from "lucide-react";
import OtpModal from "../../components/Delivery/OtpModal";
import CancelModal from "../../components/Delivery/CancelModal";
import DeliveryOrderCard from "../../components/Delivery/DeliveryOrderCard";
import Loading from "../../components/Loading";
import type { Order } from "../../types";
import api from "../../config/api";
import toast from "react-hot-toast";
import { getApiErrorMessage } from "../../utils/apiError";

export default function DeliveryDashboard() {
	const [orders, setOrders] = useState<Order[]>([]);
	const [loading, setLoading] = useState(true);
	const [tab, setTab] = useState<"active" | "completed">("active");
	const [tracking, setTracking] = useState(false);

	// OTP modal
	const [otpModal, setOtpModal] = useState<string | null>(null);
	const [otp, setOtp] = useState("");
	const [submitting, setSubmitting] = useState(false);

	// Cancel modal
	const [cancelModal, setCancelModal] = useState<string | null>(null);
	const [cancelReason, setCancelReason] = useState("");

	const fetchOrders = async () => {
		setLoading(true);
		try {
			const response = await api.get(`/delivery/my-deliveries?status=${tab}`);
			setOrders(response.orders || []);
		} catch (error) {
			toast.error(getApiErrorMessage(error, "Failed to fetch deliveries."));
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchOrders();
	}, [tab]);

	useEffect(() => {
		if (!tracking || tab !== "active" || orders.length === 0) {
			return;
		}

		const activeOrderIds = orders
			.filter((order) =>
				["Confirmed", "Preparing", "OutForDelivery"].includes(order.status),
			)
			.map((order) => order.id);

		if (activeOrderIds.length === 0 || !navigator.geolocation) {
			return;
		}

		const watchId = navigator.geolocation.watchPosition(
			(position) => {
				const payload = {
					lat: position.coords.latitude,
					lng: position.coords.longitude,
				};
				activeOrderIds.forEach((orderId) => {
					api.put(`/delivery/my-deliveries/${orderId}/location`, payload).catch(
						() => undefined,
					);
				});
			},
			() => toast.error("Unable to share your location."),
			{ enableHighAccuracy: true, maximumAge: 15000, timeout: 15000 },
		);

		return () => navigator.geolocation.clearWatch(watchId);
	}, [tracking, tab, orders]);

	const handleUpdateStatus = async (orderId: string, status: string) => {
		try {
			const response = await api.put(`/delivery/my-deliveries/${orderId}/status`, {
				status,
			});
			setOrders((prev) =>
				prev.map((order) => (order.id === orderId ? response.order : order)),
			);
			toast.success("Delivery status updated.");
		} catch (error) {
			toast.error(getApiErrorMessage(error, "Failed to update status."));
		}
	};

	const handleComplete = async () => {
		if (!otpModal || !otp) return;
		setSubmitting(true);
		try {
			const response = await api.put(`/delivery/my-deliveries/${otpModal}/complete`, {
				otp,
			});
			setOrders((prev) =>
				prev.map((order) => (order.id === otpModal ? response.order : order)),
			);
			toast.success("Delivery completed.");
			setOtpModal(null);
			setOtp("");
		} catch (error) {
			toast.error(getApiErrorMessage(error, "Failed to complete delivery."));
		} finally {
			setSubmitting(false);
		}
	};

	const handleCancel = async () => {
		if (!cancelModal) return;
		setSubmitting(true);
		try {
			const response = await api.put(`/delivery/my-deliveries/${cancelModal}/cancel`, {
				reason: cancelReason,
			});
			setOrders((prev) =>
				prev.map((order) => (order.id === cancelModal ? response.order : order)),
			);
			toast.success("Delivery cancelled.");
			setCancelModal(null);
			setCancelReason("");
		} catch (error) {
			toast.error(getApiErrorMessage(error, "Failed to cancel delivery."));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="space-y-6">
			{/* Tabs + Tracking toggle */}
			<div className="flex items-center gap-2 flex-wrap">
				{(["active", "completed"] as const).map((t) => (
					<button
						key={t}
						onClick={() => setTab(t)}
						className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${tab === t ? "bg-app-green text-white" : "bg-white text-zinc-600 hover:bg-app-cream border border-app-border"}`}
					>
						{t === "active" ? "Active" : "Completed"}
					</button>
				))}
				<div className="ml-auto">
					<button
						onClick={() => setTracking((prev) => !prev)}
						className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors flex items-center gap-1.5 ${tracking ? "bg-green-600 text-white" : "bg-white text-zinc-600 border border-app-border hover:bg-app-cream"}`}
					>
						<NavigationIcon
							className={`w-3.5 h-3.5 ${tracking ? "animate-pulse" : ""}`}
						/>
						{tracking ? "Sharing Location" : "Share Location"}
					</button>
				</div>
			</div>

			{/* Orders */}
			{loading ? (
				<Loading />
			) : orders.length === 0 ? (
				<div className="text-center py-16 bg-white rounded-2xl border border-app-border">
					<PackageIcon className="size-12 text-app-border mx-auto mb-3" />
					<p className="text-lg font-semibold text-zinc-900 mb-1">
						No {tab} deliveries
					</p>
					<p className="text-sm text-zinc-500">
						{tab === "active"
							? "You'll see new assignments here"
							: "Completed deliveries will appear here"}
					</p>
				</div>
			) : (
				<div className="space-y-4">
					{orders.map((order) => (
						<DeliveryOrderCard
							key={order.id}
							order={order}
							tab={tab}
							handleUpdateStatus={handleUpdateStatus}
							setOtpModal={setOtpModal}
							setCancelModal={setCancelModal}
						/>
					))}
				</div>
			)}

			{/* OTP Modal */}
			{otpModal && (
				<OtpModal
					setOtpModal={setOtpModal}
					otp={otp}
					setOtp={setOtp}
					handleComplete={handleComplete}
					submitting={submitting}
				/>
			)}
			{/* Cancel Modal */}
			{cancelModal && (
				<CancelModal
					setCancelModal={setCancelModal}
					cancelReason={cancelReason}
					setCancelReason={setCancelReason}
					handleCancel={handleCancel}
					submitting={submitting}
				/>
			)}
		</div>
	);
}
