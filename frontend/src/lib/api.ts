import axios from "axios";

const apiBaseUrl =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? "http://localhost:8000" : undefined);

if (!apiBaseUrl) {
  throw new Error("VITE_API_URL must be set for production builds");
}

const api = axios.create({
  baseURL: apiBaseUrl,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401 && window.location.pathname !== "/login") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.assign("/login");
    }
    return Promise.reject(error);
  },
);

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;
  const responseData = error.response?.data as { detail?: unknown } | undefined;
  if (typeof responseData?.detail === "string") return responseData.detail;
  if (Array.isArray(responseData?.detail)) {
    return responseData.detail
      .map((issue: { msg?: string; loc?: (string | number)[] }) => {
        const field = issue.loc?.[issue.loc.length - 1];
        return field ? `${String(field)}: ${issue.msg ?? "invalid value"}` : issue.msg;
      })
      .filter(Boolean)
      .join(". ");
  }
  if (error.response?.status === 403) return "Akun ini tidak memiliki izin untuk tindakan tersebut.";
  return fallback;
}

export default api;
