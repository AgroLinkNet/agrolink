// FILE LOCATION: src/app/login/page.tsx
//
// The login screen. 'use client' at the top means this runs in
// the browser, which it must, because it handles typing and
// button clicks.

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit() {
    setMessage('')

    if (!email || !password) {
      setMessage('Completa el correo y la contraseña.')
      return
    }

    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      setLoading(false)

      if (error) {
        setMessage('No pudimos entrar: ' + error.message)
        return
      }
      router.push('/dashboard')
      router.refresh()
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })
      setLoading(false)

      if (error) {
        setMessage('No pudimos crear la cuenta: ' + error.message)
        return
      }
      // If email confirmation is ON, no session comes back yet.
      if (!data.session) {
        setMessage('Revisa tu correo para confirmar la cuenta.')
        return
      }
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F4EF] px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-[#1B4332]">AgroLink</h1>
        <p className="mt-1 mb-6 text-sm text-neutral-500">
          Cada metro cuadrado, escuchado.
        </p>

        <label className="mb-1 block text-sm text-neutral-700">Correo</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          className="mb-4 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder-neutral-400 outline-none focus:border-[#1B4332]"
          placeholder="tu@correo.com"
        />
        <label className="mb-1 block text-sm text-neutral-700">Contraseña</label>
        
        <div className="relative mb-5">
        <input
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 pr-16 text-neutral-900 placeholder-neutral-400 outline-none focus:border-[#1B4332]"
          placeholder="••••••••"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#1B4332]"
        >
          {showPassword ? 'Ocultar' : 'Ver'}
        </button>
      </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full rounded-lg bg-[#1B4332] py-2.5 font-medium text-white transition hover:bg-[#143728] disabled:opacity-50"
        >
          {loading
            ? 'Cargando...'
            : mode === 'login'
              ? 'Entrar'
              : 'Crear cuenta'}
        </button>

        <button
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login')
            setMessage('')
          }}
          className="mt-4 w-full text-sm text-[#1B4332] underline underline-offset-2"
        >
          {mode === 'login'
            ? '¿No tenés cuenta? Crear una'
            : '¿Ya tenés cuenta? Entrar'}
        </button>

        {message && (
          <p className="mt-4 rounded-lg bg-[#FDF0E6] p-3 text-sm text-[#8A4B1D]">
            {message}
          </p>
        )}
      </div>
    </main>
  )
}
