import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { AGENT_ID_KEY, ROLE_KEY, TOKEN_KEY } from '../api/client'
import { login as loginRequest } from '../api/endpoints'
import type { UserRole } from '../types'

interface AuthState {
  token: string | null
  role: UserRole | null
  agentId: number | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

function decodeAgentId(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.agent_id ?? null
  } catch {
    return null
  }
}

function decodeRole(token: string): UserRole | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.role ?? null
  } catch {
    return null
  }
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [role, setRole] = useState<UserRole | null>(() => (localStorage.getItem(ROLE_KEY) as UserRole | null))
  const [agentId, setAgentId] = useState<number | null>(() => {
    const raw = localStorage.getItem(AGENT_ID_KEY)
    return raw ? Number(raw) : null
  })

  const value = useMemo<AuthState>(
    () => ({
      token,
      role,
      agentId,
      isAuthenticated: Boolean(token),
      async login(email: string, password: string) {
        const res = await loginRequest(email, password)
        const decodedRole = decodeRole(res.access_token)
        const decodedAgentId = decodeAgentId(res.access_token)
        localStorage.setItem(TOKEN_KEY, res.access_token)
        if (decodedRole) localStorage.setItem(ROLE_KEY, decodedRole)
        if (decodedAgentId) localStorage.setItem(AGENT_ID_KEY, String(decodedAgentId))
        setToken(res.access_token)
        setRole(decodedRole)
        setAgentId(decodedAgentId)
      },
      logout() {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(ROLE_KEY)
        localStorage.removeItem(AGENT_ID_KEY)
        setToken(null)
        setRole(null)
        setAgentId(null)
      },
    }),
    [token, role, agentId],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
