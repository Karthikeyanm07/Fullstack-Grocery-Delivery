import axios from "axios";

const client = axios.create({
	baseURL: import.meta.env.VITE_BASE_URL || "http://localhost:5000/api",
	withCredentials: true,
});

client.interceptors.request.use(
	(config) => config,
	(error) => Promise.reject(error),
);

// Handle auth error globally
client.interceptors.response.use(
	(response) => response.data.data,
	(error) => {
		if (error.response?.status === 401) {
			const url = String(error.config?.url || "");
			window.dispatchEvent(
				new Event(url.startsWith("/delivery") ? "delivery:logout" : "auth:logout"),
			);
		}
		return Promise.reject(error);
	},
);

const api = {
	get: <T = any>(...args: Parameters<typeof client.get>) =>
		client.get(...args) as Promise<T>,
	post: <T = any>(...args: Parameters<typeof client.post>) =>
		client.post(...args) as Promise<T>,
	put: <T = any>(...args: Parameters<typeof client.put>) =>
		client.put(...args) as Promise<T>,
	delete: <T = any>(...args: Parameters<typeof client.delete>) =>
		client.delete(...args) as Promise<T>,
};

export default api;
