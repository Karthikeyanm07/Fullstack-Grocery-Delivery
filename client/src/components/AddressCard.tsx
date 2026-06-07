import { CheckIcon, MapPinIcon, PencilIcon, Trash2Icon } from "lucide-react";
import type { Address } from "../types/index.ts";
import api from "../config/api.ts";
import { useAuth } from "../context/AuthContext.tsx";
import toast from "react-hot-toast";

interface AddressCardProps {
	address: Address;
	onEditHandler: (address: Address) => void;
	setAddresses: (addresses: Address[]) => void;
}
const AddressCard = ({
	address,
	onEditHandler,
	setAddresses,
}: AddressCardProps) => {
	const { updateUser } = useAuth();

	const handleDelete = async (id: string) => {
		try {
			const confirm = window.confirm(
				`Are you sure you want to delete this address`,
			);
			if (!confirm) {
				return;
			}

			const res = await api.delete(`/addresses/${id}`);
			setAddresses(res.addresses);
			updateUser({ addresses: res.addresses });
			toast.success(`Address removed`);
		} catch (error: any) {
			toast.error(error.response?.data.message || error?.message);
		}
	};

	return (
		<div className="max-w-3xl bg-white rounded-2xl p-6 flex items-start justify-between">
			{/* Left */}
			<div className="flex gap-4 flex-1 min-w-0">
				<div className="size-10 rounded-xl bg-app-cream flex-center shrink-0">
					<MapPinIcon className="size-5 text-app-green" />
				</div>
				<div className="min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<p className="text-sm font-semibold text-app-green">
							{address.label}
						</p>
						{address.isDefault && (
							<span
								className="flex-center gap-1 px-2.5 py-0.5 text-[10px] 
								font-medium bg-app-green text-white rounded-full"
							>
								<CheckIcon className="size-2.5" />
								Default
							</span>
						)}
					</div>
					{(address.name || address.phone) && (
						<p className="text-xs text-app-green font-medium">
							{address.name}{address.name && address.phone ? " • " : ""}{address.phone}
						</p>
					)}
					<p className="text-sm text-app-text-light">
						{address.address}{address.landmark ? `, ${address.landmark}` : ""}, {address.city}, <br />{" "}
						{address.state} – {address.zip}
					</p>
				</div>
			</div>

			{/* Right - Action buttons */}
			<div className="flex items-center gap-1">
				<button
					className="p-2 text-app-text-light hover:text-app-green hover:bg-app-cream rounded-lg transition-colors"
					onClick={() => onEditHandler(address)}
				>
					<PencilIcon className="size-4" />
				</button>

				<button
					className="p-2 text-app-text-light hover:text-app-error hover:bg-red-50 rounded-lg transition-colors"
					onClick={() => handleDelete(address.id)}
				>
					<Trash2Icon className="size-4" />
				</button>
			</div>
		</div>
	);
};

export default AddressCard;
