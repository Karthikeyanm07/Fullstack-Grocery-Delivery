export const getApiErrorMessage = (
	error: unknown,
	fallback = "Something went wrong. Please try again.",
) => {
	if (
		error &&
		typeof error === "object" &&
		"response" in error &&
		error.response &&
		typeof error.response === "object" &&
		"data" in error.response
	) {
		const data = error.response.data as { message?: unknown };
		if (typeof data.message === "string") {
			return data.message;
		}
	}

	if (error instanceof Error && error.message) {
		return error.message;
	}

	return fallback;
};
