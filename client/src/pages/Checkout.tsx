import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext.tsx";
import {
	ArrowLeftIcon,
	CheckIcon,
	ChevronRightIcon,
	CreditCardIcon,
	MapPinIcon,
} from "lucide-react";
import CheckoutAddress from "../components/Checkout/CheckoutAddress.tsx";
import CheckoutPayment from "../components/Checkout/CheckoutPayment.tsx";
import CheckoutReview from "../components/Checkout/CheckoutReview.tsx";
import type { Address } from "../types/index.ts";
import api from "../config/api.ts";
import toast from "react-hot-toast";
import { getApiErrorMessage } from "../utils/apiError.ts";

const Checkout = () => {
	const { items, cartTotal, clearCart } = useCart();

	const [step, setStep] = useState("address");
	const [loading, setLoading] = useState(false);
	const [addresses, setAddresses] = useState<Address[]>([]);
	const [addressesLoading, setAddressesLoading] = useState(true);
	const [address, setAddress] = useState<Address>({
		id: "",
		label: "Home",
		name: "",
		phone: "",
		address: "",
		landmark: "",
		city: "",
		state: "",
		zip: "",
		isDefault: false,
		lat: 0,
		lng: 0,
	});
	const [paymentMethod, setPaymentMethod] = useState("cash");

	const deliveryFee = cartTotal >= 500 ? 0 : 100;
	const tax = Math.round(cartTotal * 0.08 * 100) / 100;
	const total = cartTotal + deliveryFee + tax;

	const navigate = useNavigate();
	const currency = import.meta.env.VITE_CURRENCY_SYMBOL;

	const steps: { key: string; label: string; icon: typeof MapPinIcon }[] = [
		{ key: "address", label: "Address", icon: MapPinIcon },
		{ key: "payment", label: "Payment", icon: CreditCardIcon },
		{ key: "review", label: "Review", icon: CheckIcon },
	];

	const handlePlaceOrder = async () => {
		setLoading(true);
		try {
			const response = await api.post("/orders", {
				items: items.map((item) => ({
					product: item.product.id,
					quantity: item.quantity,
				})),
				shippingAddress: address,
				paymentMethod,
			});
			clearCart();
			toast.success("Order placed successfully.");
			navigate(`/orders/${response.order.id}`);
		} catch (error) {
			toast.error(getApiErrorMessage(error, "Failed to place order."));
		} finally {
			setLoading(false);
		}
	};

	// Populate address from users default address
	useEffect(() => {
		const fetchAddresses = async () => {
			try {
				const response = await api.get("/addresses");
				const savedAddresses = response.addresses || [];
				setAddresses(savedAddresses);
				if (savedAddresses.length) {
					const defaultAddress =
						savedAddresses.find((a: Address) => a.isDefault) ||
						savedAddresses[0];
					setAddress(defaultAddress);
				}
			} catch (error) {
				toast.error(
					getApiErrorMessage(error, "Failed to fetch addresses."),
				);
			} finally {
				setAddressesLoading(false);
			}
		};
		fetchAddresses();
	}, []);

	if (items.length === 0) {
		return (
			<div className="min-h-screen bg-app-cream flex-center">
				<div className="text-center">
					<h2 className="text-xl font-semibold text-app-green mb-2">
						Your cart is empty
					</h2>
					<p className="text-sm text-app-text-light mb-4">
						Add some products to checkout
					</p>
					<button
						className="px-5 py-2.5 bg-app-green text-white text-sm font-medium rounded-xl
						hover:bg-app-green-light transition-colors"
						onClick={() => navigate("/products")}
					>
						Browse Products
					</button>
				</div>
			</div>
		);
	}
	return (
		<div className="min-h-screen bg-app-cream">
			<div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				{/* Back button */}
				<button
					className="flex items-center gap-2 text-sm text-app-text-light hover:text-app-green
					mb-6 transition-colors"
					onClick={() => navigate(-1)}
				>
					<ArrowLeftIcon className="size-4" />
					Back
				</button>

				<h1 className="text-2xl font-semibold text-app-green mb-8">
					Checkout
				</h1>

				{/* Checkout Steps */}
				<div className="flex items-center gap-2 mb-8">
					{steps.map((s, i) => (
						<div key={s.key} className="flex items-center gap-2">
							<button
								className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
								transition-colors ${
									step === s.key
										? "bg-app-green text-white"
										: "bg-white text-app-text-light"
								}`}
								onClick={() => setStep(s.key)}
							>
								<s.icon className="size-4" />
								{s.label}
								{i < step.length - 1 && (
									<ChevronRightIcon className="size-4 text-app-text-light" />
								)}
							</button>
						</div>
					))}
				</div>

				<div className="grid grid-cols-3 gap-6">
					{/* Main form */}
					<div className="md:col-span-2">
						{step === "address" && (
							<CheckoutAddress
								address={address}
								setAddress={setAddress}
								setStep={setStep}
								addresses={addresses}
								loading={addressesLoading}
							/>
						)}

						{step === "payment" && (
							<CheckoutPayment
								paymentMethod={paymentMethod}
								setPaymentMethod={setPaymentMethod}
								setStep={setStep}
							/>
						)}

						{step === "review" && (
							<CheckoutReview
								address={address}
								handlePlaceOrder={handlePlaceOrder}
								items={items}
								loading={loading}
								total={total}
								paymentMethod={paymentMethod}
							/>
						)}
					</div>

					{/* Order summary sidebar */}
					<div className="bg-white rounded-2xl p-5 h-fit sticky top-24">
						<h3 className="text-sm font-semibold text-app-green mb-4">
							Order Summary
						</h3>
						<div className="space-y-2 text-sm">
							<div className="flex justify-between">
								<span className="text-app-text-light">
									Subtotal ({items.length} items)
								</span>
								<span>
									{currency}
									{cartTotal.toFixed(2)}
								</span>
							</div>

							<div className="flex justify-between">
								<span className="text-app-text-light">
									Delivery
								</span>
								<span>
									{deliveryFee === 0 ? (
										<span className="text-app-success">
											Free
										</span>
									) : (
										`${currency}${deliveryFee.toFixed(2)}`
									)}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-app-text-light">Tax</span>
								<span>
									{currency}
									{tax.toFixed(2)}
								</span>
							</div>
							<div className="flex justify-between pt-3 border-t border-app-border text-base font-semibold">
								<span>Total</span>
								<span className="text-app-green">
									{currency}
									{total.toFixed(2)}
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Checkout;
