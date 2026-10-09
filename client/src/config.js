// Single source of truth for the backend URL.
// Override per environment with VITE_API_URL (e.g. http://localhost:5000) in client/.env
export const API_ORIGIN = (
  import.meta.env.VITE_API_URL || "https://software-check-cbuc.vercel.app"
).replace(/\/+$/, "")

export const API_BASE_URL = `${API_ORIGIN}/api`
