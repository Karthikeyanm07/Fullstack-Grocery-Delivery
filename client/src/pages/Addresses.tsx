import { useEffect, useState } from "react";
import type { Address } from "../types/index.ts";
import { MapPinIcon, PlusIcon } from "lucide-react";
import Loading from "../components/Loading.tsx";
import AddressCard from "../components/AddressCard.tsx";
import AddressForm from "../components/AddressForm.tsx";
import { useAuth } from "../context/AuthContext.tsx";
import api from "../config/api.ts";
import toast from "react-hot-toast";

const Addresses = () => {
	const { updateUser } = useAuth();

	const [addresses, setAddresses] = useState<Address[]>([]);
	const [loading, setLoading] = useState(true);
	const [showForm, setShowForm] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState({
		label: "",
		name: "",
		phone: "",
		address: "",
		landmark: "",
		city: "",
		state: "",
		zip: "",
		isDefault: false,
	});

	const resetForm = () => {
		setForm({
			label: "",
			name: "",
			phone: "",
			address: "",
			landmark: "",
			city: "",
			state: "",
			zip: "",
			isDefault: false,
		});

		setShowForm(false);
		setEditingId(null);
	};

	// Get location
	const getLocation = (
		retries = 3,
	): Promise<{ lat: number; lng: number }> => {
		return new Promise((resolve, reject) => {
			if (!navigator.geolocation) {
				reject(new Error("Geolocation not supported"));
				return;
			}

			const attempt = () => {
				navigator.geolocation.getCurrentPosition(
					(position) => {
						resolve({
							lat: position.coords.latitude,
							lng: position.coords.longitude,
						});
					},
					(error: any) => {
						if (retries > 0) {
							retries--;
							setTimeout(attempt, 1000);
						} else {
							reject(
								new Error(
									error.message ||
										"Failed to get location after retries",
								),
							);
						}
					},
					{
						enableHighAccuracy: false,
						timeout: 15000,
						maximumAge: 60000,
					},
				);
			};
			attempt();
		});
	};

	const handleSubmit = async (e: React.SubmitEvent) => {
		e.preventDefault();
		try {
			const coordinates = await getLocation();
			const payload = { ...form, ...coordinates };

			if (editingId) {
				const res = await api.put(
					`/addresses/${editingId}`,
					payload,
				);
				setAddresses(res.addresses);
				updateUser({ addresses: res.addresses });
				toast.success(`Address updated!`);
			} else {
				const res = await api.post(`/addresses`, payload);
				setAddresses(res.addresses);
				updateUser({ addresses: res.addresses });
				toast.success(`Address added!`);
			}
			resetForm();
		} catch (error: any) {
			toast.error(error.response?.data.message || error?.message);
		}
	};

	const onEditHandler = (address: Address) => {
		setForm({
			label: address.label,
			name: address.name,
			phone: address.phone,
			address: address.address,
			landmark: address.landmark,
			city: address.city,
			state: address.state,
			zip: address.zip,
			isDefault: address.isDefault,
		});

		setEditingId(address.id);
		setShowForm(true);
	};

	useEffect(() => {
		const fetchAddresses = async () => {
			try {
				const response = await api.get(`/addresses`);
				setAddresses(response.addresses);
			} catch (error: any) {
				toast.error(error.response?.data.message || error?.message);
			} finally {
				setLoading(false);
			}
		};
		fetchAddresses();
	}, []);
	return (
		<div className="min-h-screen bg-app-cream">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				{/* Page header */}
				<div className="flex items-center justify-between mb-8">
					<h1 className="text-2xl font-semibold text-app-green">
						My Addresses
					</h1>
					<button
						className="px-4 py-2 bg-app-green text-white text-sm font-semibold 
						rounded-xl hover:bg-app-green-light transition-colors flex items-center gap-2"
						onClick={() => {
							resetForm();
							setShowForm(true);
						}}
					>
						<PlusIcon className="size-4" /> Add Address
					</button>
				</div>

				{/* Form modal */}
				{showForm && (
					<AddressForm
						resetForm={resetForm}
						handleSubmit={handleSubmit}
						form={form}
						setForm={setForm}
						editingId={editingId}
					/>
				)}

				{/* Address list */}
				{loading ? (
					<Loading />
				) : addresses.length === 0 ? (
					<div className="text-center py-16">
						<MapPinIcon className="size-16 text-app-border mx-auto mb-4" />
						<h2 className="text-lg font-semibold text-app-green mb-2">
							No addresses saved
						</h2>
						<p className="text-sm text-app-text-light">
							Add an address for faster checkout
						</p>
					</div>
				) : (
					<div className="space-y-4">
						{addresses.map((addr) => (
							<AddressCard
								key={addr.id}
								address={addr}
								onEditHandler={onEditHandler}
								setAddresses={setAddresses}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
};

export default Addresses;
