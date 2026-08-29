// FILE LOCATION: app/signup/page.tsx
//
// Registro con validación en vivo.
//
// Reglas de contraseña (deliberadamente simples):
//   - mínimo 8 caracteres
//   - al menos una letra
//   - al menos un número
// Mayúsculas y símbolos suman al indicador de fuerza pero no
// son obligatorios. Exigir demasiado empuja a la gente a
// escribir la clave en un papel, que es peor.

'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const COUNTRY_CODES = [
  { code: '+595', label: '🇵🇾 +595' },
  { code: '+54', label: '🇦🇷 +54' },
  { code: '+55', label: '🇧🇷 +55' },
  { code: '+598', label: '🇺🇾 +598' },
  { code: '+591', label: '🇧🇴 +591' },
  { code: '+56', label: '🇨🇱 +56' },
]

// -------------------------------------------------------------
// Fuerza de la contraseña
//
// Separa "requisitos" (obligatorios) de "fuerza" (informativa).
// El botón se habilita con los requisitos; la barra solo
// orienta al usuario.
// -------------------------------------------------------------
type Strength = { score: number; label: string; color: string; bar: string }

function scorePassword(pw: string): Strength {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[a-z]/.test(pw) && /\d/.test(pw)) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++

  if (pw.length === 0)
    return { score: 0, label: '', color: '', bar: 'bg-neutral-200' }
  if (score <= 1)
    return {
      score,
      label: 'Débil',
      color: 'text-[#8C2F16]',
      bar: 'bg-[#C1440E]',
    }
  if (score === 2)
    return {
      score,
      label: 'Aceptable',
      color: 'text-[#8A5A12]',
      bar: 'bg-[#E9C46A]',
    }
  if (score === 3)
    return {
      score,
      label: 'Buena',
      color: 'text-[#4D7C0F]',
      bar: 'bg-[#84CC16]',
    }
  return {
    score,
    label: 'Fuerte',
    color: 'text-[#163A2C]',
    bar: 'bg-[#163A2C]',
  }
}

function Requirement({ met, children }: { met: boolean; children: string }) {
  return (
    <li
      className={
        'flex items-center gap-1.5 text-xs ' +
        (met ? 'text-[#4D7C0F]' : 'text-neutral-500')
      }
    >
      <span className="inline-block w-3 text-center">{met ? '✓' : '○'}</span>
      {children}
    </li>
  )
}

export default function SignupPage() {
  const [fullName, setFullName] = useState('')
  const [farmName, setFarmName] = useState('')
  const [countryCode, setCountryCode] = useState('+595')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  const hasLength = password.length >= 8
  const hasLetter = /[a-zA-Z]/.test(password)
  const hasNumber = /\d/.test(password)
  const passwordOk = hasLength && hasLetter && hasNumber
  const matches = confirm.length > 0 && password === confirm

  const strength = useMemo(() => scorePassword(password), [password])

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const phoneDigits = phone.replace(/\D/g, '')
  const phoneOk = phoneDigits.length >= 6 && phoneDigits.length <= 12

  const canSubmit =
    fullName.trim().length >= 2 &&
    farmName.trim().length >= 2 &&
    emailOk &&
    phoneOk &&
    passwordOk &&
    matches &&
    !loading

  async function handleSubmit() {
    setMessage('')
    if (!canSubmit) return

    setLoading(true)

    // Los tres campos extra viajan en options.data y terminan en
    // raw_user_meta_data. El trigger de la base los lee desde ahí
    // para crear el perfil y la plantación.
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          phone: `${countryCode} ${phoneDigits}`,
          farm_name: farmName.trim(),
        },
      },
    })

    setLoading(false)

    if (error) {
      setMessage(
        error.message.includes('already registered')
          ? 'Ya existe una cuenta con ese correo. Probá iniciar sesión.'
          : 'No pudimos crear la cuenta: ' + error.message
      )
      return
    }

    // Si la confirmación por correo está activada no vuelve sesión.
    if (!data.session) {
      setMessage('Revisá tu correo para confirmar la cuenta.')
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  const inputClass =
    'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder-neutral-400 outline-none focus:border-[#163A2C]'

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F2EBD9] px-4 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-6 inline-block text-sm text-neutral-600 transition hover:text-[#163A2C]"
        >
          ← Volver al inicio
        </Link>

        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-[#163A2C]">Crear cuenta</h1>
          <p className="mt-1 mb-6 text-sm text-neutral-500">
            Empezá a monitorear tu plantación.
          </p>

          {/* nombre */}
          <label className="mb-1 block text-sm text-neutral-700">
            Nombre completo
          </label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputClass + ' mb-4'}
            placeholder="Lucas Winckler"
            autoComplete="name"
          />

          {/* finca */}
          <label className="mb-1 block text-sm text-neutral-700">
            Nombre de la plantación
          </label>
          <input
            value={farmName}
            onChange={(e) => setFarmName(e.target.value)}
            className={inputClass + ' mb-4'}
            placeholder="Estancia San Miguel"
          />

          {/* teléfono */}
          <label className="mb-1 block text-sm text-neutral-700">Teléfono</label>
          <div className="mb-4 flex gap-2">
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="shrink-0 rounded-lg border border-neutral-300 bg-white px-2 py-2 text-neutral-900 outline-none focus:border-[#163A2C]"
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
              placeholder="981 123456"
              autoComplete="tel"
            />
          </div>

          {/* correo */}
          <label className="mb-1 block text-sm text-neutral-700">Correo</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass + ' mb-4'}
            placeholder="tu@correo.com"
            autoComplete="email"
          />

          {/* contraseña */}
          <label className="mb-1 block text-sm text-neutral-700">
            Contraseña
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass + ' pr-16'}
              placeholder="••••••••"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#163A2C]"
            >
              {showPassword ? 'Ocultar' : 'Ver'}
            </button>
          </div>

          {/* barra de fuerza */}
          {password.length > 0 && (
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
                  <div
                    className={'h-full rounded-full transition-all ' + strength.bar}
                    style={{ width: `${(strength.score / 5) * 100}%` }}
                  />
                </div>
                <span className={'text-xs font-medium ' + strength.color}>
                  {strength.label}
                </span>
              </div>
            </div>
          )}

          {/* requisitos */}
          <ul className="mt-2.5 space-y-1">
            <Requirement met={hasLength}>Al menos 8 caracteres</Requirement>
            <Requirement met={hasLetter}>Al menos una letra</Requirement>
            <Requirement met={hasNumber}>Al menos un número</Requirement>
          </ul>

          {/* repetir contraseña */}
          <label className="mb-1 mt-4 block text-sm text-neutral-700">
            Repetir contraseña
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className={
              inputClass +
              (confirm.length > 0 && !matches ? ' border-[#C1440E]' : '')
            }
            placeholder="••••••••"
            autoComplete="new-password"
          />
          {confirm.length > 0 && !matches && (
            <p className="mt-1.5 text-xs text-[#8C2F16]">
              Las contraseñas no coinciden.
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="mt-6 w-full rounded-lg bg-[#163A2C] py-2.5 font-medium text-white transition hover:bg-[#0B1F17] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>

          {message && (
            <p className="mt-4 rounded-lg bg-[#FDF1ED] p-3 text-sm text-[#8C2F16]">
              {message}
            </p>
          )}

          <p className="mt-6 border-t border-neutral-200 pt-5 text-center text-sm text-neutral-600">
            ¿Ya tenés cuenta?{' '}
            <Link
              href="/login"
              className="font-medium text-[#163A2C] underline underline-offset-2"
            >
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}