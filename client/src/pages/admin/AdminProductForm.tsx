import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeftIcon } from "lucide-react";
import { categoriesData } from "../../assets/assets";
import Loading from "../../components/Loading";
import api from "../../config/api";
import toast from "react-hot-toast";
import { getApiErrorMessage } from "../../utils/apiError";

export default function AdminProductForm() {
	const { id } = useParams();
	const navigate = useNavigate();
	const isEdit = Boolean(id);

	const [loading, setLoading] = useState(isEdit);
	const [saving, setSaving] = useState(false);
	const [imageFile, setImageFile] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState("");

	const [formData, setFormData] = useState({
		name: "",
		description: "",
		price: "",
		originalPrice: "",
		image: "",
		category: "",
		unit: "",
		stock: "",
		isOrganic: false,
	});

	useEffect(() => {
		const fetchData = async () => {
			if (isEdit) {
				try {
					const response = await api.get(`/products/${id}`);
					const product = response.product;
					setFormData({
						name: product.name || "",
						description: product.description || "",
						price: String(product.price ?? ""),
						originalPrice: product.originalPrice
							? String(product.originalPrice)
							: "",
						image: product.image || "",
						category: product.category || "",
						unit: product.unit || "",
						stock: String(product.stock ?? ""),
						isOrganic: Boolean(product.isOrganic),
					});
				} catch (error) {
					toast.error(getApiErrorMessage(error, "Failed to fetch product."));
					navigate("/admin/products");
				}
			}
			setLoading(false);
		};
		fetchData();
	}, [id, isEdit, navigate]);

	useEffect(() => {
		if (!imageFile) {
			setPreviewUrl("");
			return;
		}

		const objectUrl = URL.createObjectURL(imageFile);
		setPreviewUrl(objectUrl);

		return () => URL.revokeObjectURL(objectUrl);
	}, [imageFile]);

	const handleSubmit = async (e: React.SubmitEvent) => {
		e.preventDefault();
		setSaving(true);
		try {
			let image = formData.image;
			if (imageFile) {
				const uploadFormData = new FormData();
				uploadFormData.append("image", imageFile);
				const uploaded = await api.post("/upload", uploadFormData, {
					headers: { "Content-Type": "multipart/form-data" },
				});
				image = uploaded.url;
			}

			const payload = {
				name: formData.name,
				description: formData.description,
				price: Number(formData.price),
				...(formData.originalPrice && {
					originalPrice: Number(formData.originalPrice),
				}),
				image,
				category: formData.category,
				unit: formData.unit,
				stock: Number(formData.stock),
				isOrganic: formData.isOrganic,
			};

			if (isEdit) {
				await api.put(`/products/${id}`, payload);
				toast.success("Product updated.");
			} else {
				await api.post("/products", payload);
				toast.success("Product created.");
			}
			navigate("/admin/products");
		} catch (error) {
			toast.error(getApiErrorMessage(error, "Failed to save product."));
		} finally {
			setSaving(false);
		}
	};

	return (
		<>
			<div className="bg-white rounded-2xl shadow-sm border border-app-border overflow-hidden">
				<div className="px-6 py-5 border-b border-app-border flex items-center gap-4">
					<Link
						to="/admin/products"
						className="p-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-500 rounded-lg transition-colors"
					>
						<ArrowLeftIcon className="size-5" />
					</Link>
					<h2 className="text-xl font-semibold text-zinc-900">
						{isEdit ? "Edit Product" : "New Product"}
					</h2>
				</div>
				{loading ? (
					<Loading />
				) : (
					<form onSubmit={handleSubmit} className="p-6 space-y-6">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<div>
								<label className="block text-sm font-medium text-zinc-700 mb-2">
									Name
								</label>
								<input
									required
									type="text"
									value={formData.name}
									onChange={(e) =>
										setFormData({
											...formData,
											name: e.target.value,
										})
									}
									className="w-full px-4 py-2.5 rounded-lg border border-zinc-200 focus:border-app-green focus:ring-1 focus:ring-app-green outline-none transition-all"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-zinc-700 mb-2">
									Category
								</label>
								<select
									required
									value={formData.category}
									onChange={(e) =>
										setFormData({
											...formData,
											category: e.target.value,
										})
									}
									className="w-full px-4 py-2.5 rounded-lg border border-zinc-200 focus:border-app-green focus:ring-1 focus:ring-app-green outline-none transition-all bg-white"
								>
									<option value="">Select a category</option>
									{categoriesData.map((c) => (
										<option key={c.slug} value={c.slug}>
											{c.name}
										</option>
									))}
								</select>
							</div>
							<div>
								<label className="block text-sm font-medium text-zinc-700 mb-2">
									Price ($)
								</label>
								<input
									required
									type="number"
									step="0.01"
									min="0"
									value={formData.price}
									onChange={(e) =>
										setFormData({
											...formData,
											price: e.target.value,
										})
									}
									className="w-full px-4 py-2.5 rounded-lg border border-zinc-200 focus:border-app-green focus:ring-1 focus:ring-app-green outline-none transition-all"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-zinc-700 mb-2">
									Original Price ($) - Optional
								</label>
								<input
									type="number"
									step="0.01"
									min="0"
									value={formData.originalPrice}
									onChange={(e) =>
										setFormData({
											...formData,
											originalPrice: e.target.value,
										})
									}
									className="w-full px-4 py-2.5 rounded-lg border border-zinc-200 focus:border-app-green focus:ring-1 focus:ring-app-green outline-none transition-all"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-zinc-700 mb-2">
									Unit
								</label>
								<input
									required
									type="text"
									placeholder="e.g., kg, piece, liter"
									value={formData.unit}
									onChange={(e) =>
										setFormData({
											...formData,
											unit: e.target.value,
										})
									}
									className="w-full px-4 py-2.5 rounded-lg border border-zinc-200 focus:border-app-green focus:ring-1 focus:ring-app-green outline-none transition-all"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-zinc-700 mb-2">
									Stock
								</label>
								<input
									required
									type="number"
									min="0"
									value={formData.stock}
									onChange={(e) =>
										setFormData({
											...formData,
											stock: e.target.value,
										})
									}
									className="w-full px-4 py-2.5 rounded-lg border border-zinc-200 focus:border-app-green focus:ring-1 focus:ring-app-green outline-none transition-all"
								/>
							</div>
							<div className="md:col-span-2">
								<label className="block text-sm font-medium text-zinc-700 mb-2">
									Product Image
								</label>
								<div className="flex items-center gap-4">
									{(imageFile || formData.image) && (
										<div className="size-16 rounded-lg border border-zinc-200 overflow-hidden shrink-0 bg-app-cream">
											<img
												src={
													previewUrl || formData.image
												}
												alt="Preview"
												className="w-full h-full object-cover"
											/>
										</div>
									)}
									<input
										type="file"
										accept="image/*"
										onChange={(e) =>
											setImageFile(
												e.target.files?.[0] || null,
											)
										}
										className="w-full px-4 py-2.5 rounded-lg border border-zinc-200 focus:border-app-green outline-none transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-app-orange file:text-white hover:file:bg-orange-600 cursor-pointer"
									/>
								</div>
							</div>
							<div className="md:col-span-2">
								<label className="block text-sm font-medium text-zinc-700 mb-2">
									Description
								</label>
								<textarea
									required
									rows={4}
									value={formData.description}
									onChange={(e) =>
										setFormData({
											...formData,
											description: e.target.value,
										})
									}
									className="w-full px-4 py-2.5 rounded-lg border border-zinc-200 focus:border-app-green focus:ring-1 focus:ring-app-green outline-none transition-all resize-none"
								/>
							</div>
							<div className="flex items-center gap-3">
								<label
									htmlFor="isOrganic"
									className="text-sm font-medium text-zinc-700 cursor-pointer"
								>
									Organic
								</label>
								<input
									type="checkbox"
									id="isOrganic"
									checked={formData.isOrganic}
									onChange={(e) =>
										setFormData({
											...formData,
											isOrganic: e.target.checked,
										})
									}
									className="size-5 text-app-green rounded border-zinc-300 focus:ring-app-green cursor-pointer"
								/>
							</div>
						</div>

						<div className="pt-6 border-t border-app-border flex justify-end">
							<button
								disabled={saving}
								type="submit"
								className="px-6 py-2.5 bg-app-orange text-white font-medium rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
							>
								{saving ? "Saving..." : "Save Product"}
							</button>
						</div>
					</form>
				)}
			</div>
		</>
	);
}
