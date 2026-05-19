import { XIcon } from "lucide-react";

const AddressForm = ({
	handleSubmit,
	resetForm,
	form,
	setForm,
	editingId,
}: any) => {
	return (
		<>
			{/* Overlay */}
			<div className="fixed inset-0 bg-black/40 z-50" />

			{/* Form modal */}
			<div
				className="fixed inset-0 flex-center p-4 z-50"
				onClick={resetForm}
			>
				<form
					className="bg-white rounded-2xl p-6 w-full max-w-lg animate-fade-in"
					onClick={(e) => e.stopPropagation()}
					onSubmit={handleSubmit}
				>
					{/* Form header */}
					<div className="flex items-center justify-between mb-5">
						<h2 className="text-lg font-semibold text-app-green">
							{editingId ? "Edit Address" : "Add New Address"}
						</h2>
						<button
							type="button"
							className="p-2 hover:bg-app-cream rounded-lg"
							onClick={resetForm}
						>
							<XIcon className="size-5" />
						</button>
					</div>

					{/* Form Fields */}
					<div className="space-y-4">
						<div>
							<label className="block text-sm font-medium text-app-green mb-1.5">
								Label
							</label>
							<input
								type="text"
								placeholder="Home, Work, etc."
								required
								className="w-full px-2 py-2.5 text-sm rounded-xl border border-app-border focus:border-app-green outline-none"
								value={form.label}
								onChange={(e) =>
									setForm({ ...form, label: e.target.value })
								}
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-app-green mb-1.5">
								Street Address
							</label>
							<input
								type="text"
								required
								className="w-full px-2 py-2.5 text-sm rounded-xl border border-app-border focus:border-app-green outline-none"
								value={form.address}
								onChange={(e) =>
									setForm({
										...form,
										address: e.target.value,
									})
								}
							/>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div>
								<label className="block text-sm font-medium text-app-green mb-1.5">
									City
								</label>
								<input
									type="text"
									required
									className="w-full px-2 py-2.5 text-sm rounded-xl border border-app-border focus:border-app-green outline-none"
									value={form.city}
									onChange={(e) =>
										setForm({
											...form,
											city: e.target.value,
										})
									}
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-app-green mb-1.5">
									State
								</label>
								<input
									type="text"
									required
									className="w-full px-2 py-2.5 text-sm rounded-xl border border-app-border focus:border-app-green outline-none"
									value={form.state}
									onChange={(e) =>
										setForm({
											...form,
											state: e.target.value,
										})
									}
								/>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div>
								<label className="block text-sm font-medium text-app-green mb-1.5">
									ZIP Code
								</label>
								<input
									type="text"
									placeholder="621415"
									required
									className="w-full px-2 py-2.5 text-sm rounded-xl border border-app-border focus:border-app-green outline-none"
									value={form.zip}
									onChange={(e) =>
										setForm({
											...form,
											zip: e.target.value,
										})
									}
								/>
							</div>
							<div className="flex items-end pb-1">
								<label className="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										checked={form.isDefault}
										onChange={(e) =>
											setForm({
												...form,
												isDefault: e.target.checked,
											})
										}
									/>
									<span>Set as default</span>
								</label>
							</div>
						</div>
					</div>

					<button
						type="submit"
						className="mt-6 w-full py-3 bg-app-green text-white font-semibold 
						rounded-xl hover:bg-app-green-light transition-colors"
					>
						{editingId ? "Update Address" : "Save Address"}
					</button>
				</form>
			</div>
		</>
	);
};

export default AddressForm;
