import axios from "axios";

const api = axios.create({
	baseURL: import.meta.env.VITE_BASE_URL,
	withCredentials: true,
});

api.interceptors.request.use(
	(config) => config,
	(error) => Promise.reject(error),
);

// Handle auth error globally
api.interceptors.response.use(
	(response) => response.data.data,
	(error) => {
		if (error.response?.status === 401) {
			window.dispatchEvent(new Event("auth:logout"));
		}
		return Promise.reject(error);
	},
);

export default api;
