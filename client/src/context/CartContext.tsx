import {
	createContext,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react";
import type { CartItem, Product } from "../types/index.ts";
import toast from "react-hot-toast";

interface CartContextType {
	items: CartItem[];
	addToCart: (product: Product, quantity?: number) => void;
	removeFromCart: (productId: string) => void;
	updateQuantity: (productId: string, quantity: number) => void;
	clearCart: () => void;
	cartCount: number;
	cartTotal: number;
	isCartOpen: boolean;
	setIsCartOpen: (open: boolean) => void;
}
const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
	const [items, setItems] = useState<CartItem[]>(() => {
		const saved = localStorage.getItem("app_cart");
		try {
			return saved ? JSON.parse(saved) : [];
		} catch (_error) {
			localStorage.removeItem("app_cart");
			return [];
		}
	});

	const [isCartOpen, setIsCartOpen] = useState(false);

	useEffect(() => {
		localStorage.setItem("app_cart", JSON.stringify(items));
	}, [items]);

	const addToCart = (product: Product, quantity = 1) => {
		if (product.stock <= 0) {
			toast.error("This product is out of stock.");
			return;
		}
		setItems((prev) => {
			const existing = prev.find(
				(item) => item.product.id === product.id,
			);
			const nextQuantity = Math.min(
				(existing?.quantity ?? 0) + quantity,
				product.stock,
			);

			if (nextQuantity < (existing?.quantity ?? 0) + quantity) {
				toast.error(`Only ${product.stock} units available.`);
			}

			if (existing) {
				return prev.map((item) =>
					item.product.id === product.id
						? {
								...item,
								quantity: nextQuantity,
							}
						: item,
				);
			}
			return [...prev, { product, quantity: nextQuantity }];
		});
	};

	const removeFromCart = (productId: string) => {
		setItems((prev) =>
			prev.filter((item) => item.product.id !== productId),
		);
	};

	const updateQuantity = (productId: string, quantity: number) => {
		if (quantity <= 0) {
			removeFromCart(productId);
			return;
		}

		setItems((prev) =>
			prev.map((item) =>
				item.product.id === productId
					? {
							...item,
							quantity: Math.min(quantity, item.product.stock),
						}
					: item,
			),
		);
	};

	const clearCart = () => {
		setItems([]);
		setIsCartOpen(false);
	};

	const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);
	const cartTotal = items.reduce(
		(sum, item) => sum + item.product.price * item.quantity,
		0,
	);
	return (
		<CartContext.Provider
			value={{
				items,
				addToCart,
				removeFromCart,
				updateQuantity,
				cartCount,
				clearCart,
				cartTotal,
				isCartOpen,
				setIsCartOpen,
			}}
		>
			{children}
		</CartContext.Provider>
	);
}

export function useCart() {
	const context = useContext(CartContext);
	if (!context) {
		throw new Error("useCart must be used within CartProvider");
	}
	return context;
}
