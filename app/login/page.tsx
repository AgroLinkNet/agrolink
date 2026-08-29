// FILE LOCATION: app/login/page.tsx
//
// Inicio de sesión únicamente. El registro vive en /signup.

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit() {
    setMessage('')

    if (!email || !password) {
      setMessage('Completá el correo y la contraseña.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setLoading(false)

    if (error) {
      // Supabase devuelve el mismo error para correo inexistente
      // y contraseña incorrecta, a propósito: revelar cuál de
      // los dos falló permitiría averiguar qué correos están
      // registrados.
      setMessage(
        error.message === 'Invalid login credentials'
          ? 'Correo o contraseña incorrectos.'
          : 'No pudimos entrar: ' + error.message
      )
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F2EBD9] px-4 py-12">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-6 inline-block text-sm text-neutral-600 transition hover:text-[#163A2C]"
        >
          ← Volver al inicio
        </Link>

        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-[#163A2C]">
            Iniciar sesión
          </h1>
          <p className="mt-1 mb-6 text-sm text-neutral-500">
            Accedé al panel de tu plantación.
          </p>

          <label className="mb-1 block text-sm text-neutral-700">Correo</label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className="mb-4 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder-neutral-400 outline-none focus:border-[#163A2C]"
            placeholder="tu@correo.com"
          />

          <label className="mb-1 block text-sm text-neutral-700">
            Contraseña
          </label>
          <div className="relative mb-5">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 pr-16 text-neutral-900 placeholder-neutral-400 outline-none focus:border-[#163A2C]"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#163A2C]"
            >
              {showPassword ? 'Ocultar' : 'Ver'}
            </button>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-lg bg-[#163A2C] py-2.5 font-medium text-white transition hover:bg-[#0B1F17] disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          {message && (
            <p className="mt-4 rounded-lg bg-[#FDF1ED] p-3 text-sm text-[#8C2F16]">
              {message}
            </p>
          )}

          <p className="mt-6 border-t border-neutral-200 pt-5 text-center text-sm text-neutral-600">
            ¿No tenés cuenta?{' '}
            <Link
              href="/signup"
              className="font-medium text-[#163A2C] underline underline-offset-2"
            >
              Crear cuenta
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}