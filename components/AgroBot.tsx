// FILE LOCATION: components/AgroBot.tsx
//
// Envuelve el web component <langflow-chat> para usarlo en React.
//
// Un web component no existe hasta que su script lo define, por
// eso el snippet suelto no renderiza nada por si solo: primero
// hay que cargar el bundle desde el CDN.

'use client'

import { useEffect, useState } from 'react'

// Orden confirmado en consola: logspace-ai@main devuelve 403,
// langflow-ai@main carga bien. Se prueban en orden por si el
// CDN cambia mas adelante.
const SCRIPT_SOURCES = [
  'https://cdn.jsdelivr.net/gh/langflow-ai/langflow-embedded-chat@main/dist/build/static/js/bundle.min.js',
  'https://cdn.jsdelivr.net/gh/logspace-ai/langflow-embedded-chat@v1.0.7/dist/build/static/js/bundle.min.js',
  'https://cdn.jsdelivr.net/gh/logspace-ai/langflow-embedded-chat@main/dist/build/static/js/bundle.min.js',
]

// -------------------------------------------------------------
// Configuracion
//
// Los tres valores salen de variables de entorno. Los literales
// de abajo son solo el respaldo si la variable no esta definida.
//
// En .env.local (y en Vercel > Settings > Environment Variables):
//   NEXT_PUBLIC_LANGFLOW_HOST=https://...trycloudflare.com
//   NEXT_PUBLIC_LANGFLOW_FLOW_ID=eee75542-...
//   NEXT_PUBLIC_LANGFLOW_API_KEY=sk-...
//
// El tunel de Cloudflare cambia de URL en cada reinicio, asi que
// tenerla en una variable evita editar codigo cada vez.
// -------------------------------------------------------------
const HOST_URL =
  process.env.NEXT_PUBLIC_LANGFLOW_HOST ??
  'https://rescue-adipex-cash-probe.trycloudflare.com'

const FLOW_ID =
  process.env.NEXT_PUBLIC_LANGFLOW_FLOW_ID ??
  'eee75542-fc3b-4887-99b9-eece248ecc9d'

const API_KEY = process.env.NEXT_PUBLIC_LANGFLOW_API_KEY ?? 'sk-4mCMt3-IPtN1l1tOjepcHvrzmqxVeZnKxEOKqwGL6PQ'

// El elemento no es JSX estandar, asi que lo tipamos localmente.
// Evita tocar el namespace global de JSX, que cambio de lugar en
// React 19 y rompe segun la version.
const LangflowChat = 'langflow-chat' as unknown as React.FC<{
  flow_id: string
  host_url: string
  window_title?: string
  chat_position?: string
  additional_headers?: string
  api_key?: string
}>

/** Carga un script una sola vez. Resuelve true si cargo bien. */
function loadScript(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const el = document.createElement('script')
    el.src = src
    el.async = true
    el.dataset.langflowEmbed = 'true'
    el.onload = () => resolve(true)
    el.onerror = () => {
      el.remove()
      resolve(false)
    }
    document.body.appendChild(el)
  })
}

export default function AgroBot({
  flowId = FLOW_ID,
  hostUrl = HOST_URL,
  apiKey = API_KEY,
  title = 'AgroBot STEAM',
}: {
  flowId?: string
  hostUrl?: string
  apiKey?: string
  title?: string
}) {
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function init() {
      // Ya definido (por ejemplo tras un remontaje).
      if (customElements.get('langflow-chat')) {
        if (!cancelled) setReady(true)
        return
      }

      // El script ya se inyecto antes: solo esperar.
      if (document.querySelector('script[data-langflow-embed]')) {
        await customElements.whenDefined('langflow-chat')
        if (!cancelled) setReady(true)
        return
      }

      for (const src of SCRIPT_SOURCES) {
        if (cancelled) return

        const ok = await loadScript(src)
        if (!ok) {
          console.warn('[AgroBot] no se pudo cargar', src)
          continue
        }

        await customElements.whenDefined('langflow-chat')
        if (!cancelled) setReady(true)
        return
      }

      if (!cancelled) setFailed(true)
    }

    init()
    return () => {
      cancelled = true
    }
  }, [])

  // Aviso en desarrollo si la clave nunca se configuro.
  useEffect(() => {
    if (apiKey === 'sk-4mCMt3-IPtN1l1tOjepcHvrzmqxVeZnKxEOKqwGL6PQ') {
      console.warn(
        '[AgroBot] NEXT_PUBLIC_LANGFLOW_API_KEY no esta definida. ' +
          'Si Langflow exige autenticacion, las peticiones daran 403.'
      )
    }
  }, [apiKey])

  if (failed) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <p className="text-sm font-medium text-neutral-800">
          Asistente no disponible
        </p>
        <p className="mt-1 text-sm text-neutral-600">
          No se pudo cargar el widget del asistente. Revisá la consola del
          navegador para ver qué falló.
        </p>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <p className="text-sm text-neutral-500">Cargando asistente...</p>
      </div>
    )
  }

  return (
    <LangflowChat
      flow_id={flowId}
      host_url={hostUrl}
      window_title={title}
      chat_position="bottom-right"
      api_key={apiKey}
    />
  )
}