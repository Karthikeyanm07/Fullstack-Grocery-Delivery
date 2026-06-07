// src/pages/ResetPassword.tsx
import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BikeIcon, Loader2Icon, LockIcon, ArrowLeftIcon } from "lucide-react";
import { heroSectionData } from "../assets/assets.ts";
import { useAuth } from "../context/AuthContext.tsx";
import api from "../config/api";
import toast from "react-hot-toast";

const ResetPassword = () => {
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const { updateUser } = useAuth();

	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [loading, setLoading] = useState(false);

	const token = searchParams.get("token");

	useEffect(() => {
		if (!token) {
			toast.error("Invalid or missing reset link.");
			navigate("/forgot-password");
		}
	}, [token, navigate]);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		// Client-side confirm check — catches mismatch before hitting the network
		if (newPassword !== confirmPassword) {
			toast.error("Passwords do not match.");
			return;
		}

		if (newPassword.length < 8) {
			toast.error("Password must be at least 8 characters.");
			return;
		}

		setLoading(true);

		try {
			const { data } = await api.post("/auth/reset-password", {
				token,
				newPassword,
			});

			if (data.data?.user) {
				updateUser(data.data.user);
			}

			toast.success("Password reset successfully. Welcome back!");
			navigate("/");
		} catch (error: any) {
			// Common case: expired or already-used link
			toast.error(
				error.response?.data?.message ??
					"Failed to reset password. Please try again.",
			);

			// If token is invalid/expired, send them back to request a fresh link
			if (error.response?.data?.code === "INVALID_OR_EXPIRED_TOKEN") {
				navigate("/forgot-password");
			}
		} finally {
			setLoading(false);
		}
	};

	// Don't render while redirecting (token is null)
	if (!token) return null;

	return (
		<div className="min-h-screen flex">
			{/* Left side — matches Login page exactly */}
			<div className="hidden lg:flex lg:w-1/2 bg-app-green relative items-center justify-center">
				<img
					src={heroSectionData.hero_image}
					className="absolute inset-0 object-cover h-full bg-center opacity-10"
				/>
				<div className="relative text-center px-12">
					<h2 className="text-4xl font-semibold text-white mb-4">
						Create a new password
					</h2>
					<p className="text-white/60 font-serif text-xl max-w-sm mx-auto">
						Choose something strong that you haven't used before.
					</p>
				</div>
			</div>

			{/* Right side */}
			<div className="flex-1 flex-center px-4 py-12 bg-app-cream">
				<div className="w-full max-w-md">
					{/* Logo */}
					<div className="text-center mb-8">
						<Link
							to="/"
							className="inline-flex items-center gap-2 mb-6"
						>
							<BikeIcon className="size-8 text-app-green" />
							<span className="text-2xl font-semibold text-app-green">
								Instacart
							</span>
						</Link>
						<h1 className="text-2xl font-semibold text-app-green mb-2">
							Set new password
						</h1>
						<p className="text-sm text-app-text-light">
							Must be at least 8 characters.
						</p>
					</div>

					<form onSubmit={handleSubmit} className="space-y-5">
						{/* New password */}
						<label className="text-sm flex flex-col gap-1">
							New password
							<div className="relative">
								<LockIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-app-text-light" />
								<input
									type="password"
									value={newPassword}
									onChange={(e) =>
										setNewPassword(e.target.value)
									}
									required
									minLength={8}
									placeholder="●●●●●●●●"
									className="w-full pl-11 pr-4 py-3 text-sm bg-white rounded-xl border 
                    not-focus:border-app-border transition-all"
								/>
							</div>
						</label>

						{/* Confirm password */}
						<label className="text-sm flex flex-col gap-1">
							Confirm new password
							<div className="relative">
								<LockIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-app-text-light" />
								<input
									type="password"
									value={confirmPassword}
									onChange={(e) =>
										setConfirmPassword(e.target.value)
									}
									required
									minLength={8}
									placeholder="●●●●●●●●"
									className="w-full pl-11 pr-4 py-3 text-sm bg-white rounded-xl border 
                    not-focus:border-app-border transition-all"
								/>
							</div>
							{/* Live mismatch hint — only shown once both fields have input */}
							{confirmPassword &&
								newPassword !== confirmPassword && (
									<span className="text-xs text-red-500 mt-1">
										Passwords do not match.
									</span>
								)}
						</label>

						<button
							type="submit"
							disabled={loading}
							className="flex-center w-full py-3 bg-green-950 text-white font-semibold 
                rounded-xl hover:bg-green-900 transition-colors disabled:opacity-50"
						>
							{loading ? (
								<Loader2Icon className="animate-spin" />
							) : (
								"Reset password"
							)}
						</button>

						<Link
							to="/login"
							className="flex-center gap-2 text-sm text-app-text-light 
                hover:text-app-green transition-colors"
						>
							<ArrowLeftIcon className="size-4" />
							Back to sign in
						</Link>
					</form>
				</div>
			</div>
		</div>
	);
};

export default ResetPassword;
