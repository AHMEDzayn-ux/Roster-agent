import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { extractErrorMessage } from '../api/client'
import { Alert, Button, Field, Input } from '../components/ui'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto mt-[6vh] max-w-[380px]">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-3 flex size-11 items-center justify-center rounded-[12px] bg-accent text-accent-fg shadow-sm">
          <CalendarDays className="size-6" strokeWidth={2.25} />
        </div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-ink">Welcome back</h1>
        <p className="mt-1 text-[13px] text-ink-muted">Sign in to your CallRoster workspace.</p>
      </div>

      <div className="rounded-card border border-line bg-surface p-6 shadow-sm">
        {error && <Alert tone="critical" message={error} className="mb-4" />}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Email">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus placeholder="you@company.com" />
          </Field>
          <Field label="Password">
            <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </Field>
          <Button type="submit" size="lg" disabled={submitting} loading={submitting} className="w-full">
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}
