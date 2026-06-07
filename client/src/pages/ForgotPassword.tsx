import { useState } from "react";
import { Link } from "react-router-dom";
import { BikeIcon, Loader2Icon, MailIcon, ArrowLeftIcon } from "lucide-react";
import { heroSectionData } from "../assets/assets.ts";
import api from "../config/api";
import toast from "react-hot-toast";

const ForgotPassword = () => {
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);

	const [submitted, setSubmitted] = useState(false);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setLoading(true);

		try {
			await api.post("/auth/forgot-password", { email });
			setSubmitted(true);
		} catch (error: any) {
			toast.error(
				error.response?.data?.message ??
					"Something went wrong. Please try again.",
			);
		} finally {
			setLoading(false);
		}
	};

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
						Forgot your password?
					</h2>
					<p className="text-white/60 font-serif text-xl max-w-sm mx-auto">
						No worries — we'll send you a link to get back into your
						account.
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
					</div>

					{/* Confirmation screen — shown after successful submit */}
					{submitted ? (
						<div className="text-center space-y-5">
							<div className="flex-center mx-auto size-16 rounded-full bg-green-100">
								<MailIcon className="size-8 text-app-green" />
							</div>
							<h1 className="text-2xl font-semibold text-app-green">
								Check your inbox
							</h1>
							<p className="text-sm text-app-text-light max-w-xs mx-auto">
								If an account exists for{" "}
								<span className="font-medium text-app-green">
									{email}
								</span>
								, we've sent a password reset link. It expires
								in 15 minutes.
							</p>
							<p className="text-xs text-app-text-light">
								Didn't receive it? Check your spam folder or{" "}
								<button
									onClick={() => setSubmitted(false)}
									className="text-orange-500 font-semibold hover:text-orange-600 transition-colors"
								>
									try again
								</button>
								.
							</p>
							<Link
								to="/login"
								className="inline-flex items-center gap-2 text-sm text-app-text-light 
                  				hover:text-app-green transition-colors"
							>
								<ArrowLeftIcon className="size-4" />
								Back to sign in
							</Link>
						</div>
					) : (
						// Request form
						<>
							<div className="text-center mb-8">
								<h1 className="text-2xl font-semibold text-app-green mb-2">
									Reset your password
								</h1>
								<p className="text-sm text-app-text-light">
									Enter your email and we'll send you a reset
									link.
								</p>
							</div>

							<form onSubmit={handleSubmit} className="space-y-5">
								<label className="text-sm flex flex-col gap-1">
									Email
									<div className="relative">
										<MailIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-app-text-light" />
										<input
											type="email"
											value={email}
											onChange={(e) =>
												setEmail(e.target.value)
											}
											required
											placeholder="john@example.com"
											className="w-full pl-11 pr-4 py-3 text-sm bg-white rounded-xl border 
                        					not-focus:border-app-border transition-all"
										/>
									</div>
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
										"Send reset link"
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
						</>
					)}
				</div>
			</div>
		</div>
	);
};

export default ForgotPassword;
