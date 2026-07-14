import axios from 'axios'

export const TOKEN_KEY = 'callroster_token'
export const ROLE_KEY = 'callroster_role'
export const AGENT_ID_KEY = 'callroster_agent_id'

// In dev, '/api' is proxied to the backend by vite.config.ts. In production,
// set VITE_API_BASE_URL (e.g. https://api.yourdomain.com/api) if the frontend
// is hosted separately from the backend.
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(ROLE_KEY)
      localStorage.removeItem(AGENT_ID_KEY)
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

export function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (detail?.message) {
      const violations: string[] = detail.violations ?? []
      return violations.length ? `${detail.message}: ${violations.join('; ')}` : detail.message
    }
    if (Array.isArray(detail)) {
      return detail.map((d: { msg?: string }) => d.msg).join('; ')
    }
    return error.message
  }
  return String(error)
}
