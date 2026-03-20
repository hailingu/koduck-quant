import { useState } from 'react'
import { useAuthStore } from '@/stores/auth'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      await login({ username, password })
      navigate('/market')
    } catch (err) {
      setError('Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-fluid-surface-container-lowest flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#1d2026_0%,#0b0e14_100%)]" />
        
        {/* Flow Streams */}
        <div className="absolute left-[10%] top-[-20%] w-px h-[300px] bg-gradient-to-b from-transparent via-fluid-primary/15 to-transparent" />
        <div className="absolute left-[25%] top-[40%] w-px h-[200px] bg-gradient-to-b from-transparent via-fluid-primary/15 to-transparent" />
        <div className="absolute left-[60%] top-[10%] w-px h-[400px] bg-gradient-to-b from-transparent via-fluid-primary/15 to-transparent" />
        <div className="absolute left-[85%] top-[60%] w-px h-[150px] bg-gradient-to-b from-transparent via-fluid-primary/15 to-transparent" />
        
        {/* Glow Orbs */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-fluid-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-fluid-secondary/5 rounded-full blur-[100px]" />
      </div>

      {/* Top Right Info */}
      <div className="fixed top-8 right-8 hidden lg:block text-right">
        <div className="text-[10px] font-mono-data text-fluid-text-dim leading-relaxed">
          LOC: SECTOR_A<br/>
          TS: {Math.floor(Date.now() / 1000)}<br/>
          CMD: INIT_AUTH
        </div>
        <div className="mt-4 w-12 h-1 bg-fluid-primary ml-auto" />
      </div>

      {/* Brand Header */}
      <header className="mb-12 text-center">
        <h1 className="font-headline text-3xl md:text-4xl font-bold tracking-tighter text-fluid-primary mb-2">
          The Fluid Ledger
        </h1>
        <p className="font-mono-data text-[10px] uppercase tracking-[0.3em] text-fluid-text-muted">
          Kinetic Command System
        </p>
      </header>

      {/* Login Card */}
      <div className="w-full max-w-[420px] glass-panel p-8 relative">
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-fluid-surface-container-lowest rounded-lg mb-8">
          <button className="flex-1 py-2 px-4 text-xs font-mono-data font-medium rounded-md transition-all bg-fluid-primary text-fluid-surface-container-lowest">
            AUTHENTICATION
          </button>
          <button className="flex-1 py-2 px-4 text-xs font-mono-data font-medium rounded-md transition-all text-fluid-text-dim hover:text-fluid-text hover:bg-fluid-surface-high">
            WALLETS
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Username Input */}
          <div className="space-y-1.5">
            <label className="font-mono-data text-[11px] uppercase tracking-wider text-fluid-text-muted px-1">
              Access Protocol ID
            </label>
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-fluid-text-dim text-lg group-focus-within:text-fluid-primary transition-colors">
                fingerprint
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="CMD_USR_8821"
                className="w-full bg-fluid-surface-container-low border border-fluid-outline-variant pl-11 pr-4 py-3 rounded-lg text-sm font-mono-data focus:outline-none focus:border-fluid-primary focus:ring-1 focus:ring-fluid-primary/30 placeholder:text-fluid-text-dim/50 transition-all"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center px-1">
              <label className="font-mono-data text-[11px] uppercase tracking-wider text-fluid-text-muted">
                Encryption Key
              </label>
              <a href="#" className="font-mono-data text-[10px] uppercase text-fluid-primary/60 hover:text-fluid-primary transition-colors">
                Recovery
              </a>
            </div>
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-fluid-text-dim text-lg group-focus-within:text-fluid-primary transition-colors">
                key
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-fluid-surface-container-low border border-fluid-outline-variant pl-11 pr-4 py-3 rounded-lg text-sm font-mono-data focus:outline-none focus:border-fluid-primary focus:ring-1 focus:ring-fluid-primary/30 placeholder:text-fluid-text-dim/50 transition-all"
              />
            </div>
          </div>

          {error && (
            <div className="text-fluid-secondary text-xs font-mono-data text-center">
              {error}
            </div>
          )}

          {/* Action Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-fluid-primary text-fluid-surface-container-lowest font-headline font-bold uppercase tracking-widest text-sm rounded-lg hover:shadow-glow-primary hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Initializing...' : 'Initialize Session'}
            </button>
          </div>
        </form>

        {/* Card Footer */}
        <div className="mt-8 flex justify-between items-center text-[10px] font-mono-data text-fluid-text-dim/50 uppercase">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-fluid-primary animate-pulse"></span>
            Terminal: Secure
          </div>
          <span>E2EE: Verified</span>
        </div>
      </div>

      {/* Global Footer */}
      <footer className="mt-auto w-full max-w-4xl border-t border-fluid-outline-variant/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 opacity-40 hover:opacity-100 transition-opacity">
        <div className="font-mono-data text-[10px] tracking-[0.2em] uppercase text-fluid-text-muted">
          © 2024 THE FLUID LEDGER | SYSTEM_HEALTH: <span className="text-fluid-primary">OPTIMAL</span>
        </div>
        <div className="flex gap-6 font-mono-data text-[10px] tracking-[0.1em] uppercase text-fluid-text-muted">
          <span className="hover:text-fluid-primary transition-colors cursor-pointer">Network Latency: 12ms</span>
          <span className="hover:text-fluid-primary transition-colors cursor-pointer">Data Feed: Live</span>
          <span className="hover:text-fluid-primary transition-colors cursor-pointer">Privacy Protocol</span>
        </div>
      </footer>

      {/* Bottom Left Visual */}
      <div className="fixed bottom-8 left-8 hidden lg:block">
        <div className="p-4 border-l border-b border-fluid-primary/20 rounded-bl-xl">
          <div className="flex gap-2">
            <div className="w-1 h-6 bg-fluid-primary/40"></div>
            <div className="w-1 h-4 bg-fluid-primary/20 mt-2"></div>
            <div className="w-1 h-8 bg-fluid-primary/60 -mt-2"></div>
          </div>
        </div>
      </div>
    </div>
  )
}
