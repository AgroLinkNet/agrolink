// FILE LOCATION: components/AgroBot.tsx
//
// Envuelve el web component <langflow-chat> para usarlo en React.
//
// Un web component no existe hasta que su script lo define, por
// eso el snippet suelto no renderiza nada por si solo: primero
// hay que cargar el bundle desde el CDN.

'use client'

import { useEffect, useState } from 'react'

// El repo se movio de logspace-ai a langflow-ai y las dos rutas
// circulan en la documentacion. Se prueban en orden hasta que
// una cargue, asi no importa cual siga viva.
const SCRIPT_SOURCES = [
  'https://cdn.jsdelivr.net/gh/logspace-ai/langflow-embedded-chat@main/dist/build/static/js/bundle.min.js',
  'https://cdn.jsdelivr.net/gh/langflow-ai/langflow-embedded-chat@main/dist/build/static/js/bundle.min.js',
  'https://cdn.jsdelivr.net/gh/logspace-ai/langflow-embedded-chat@v1.0.7/dist/build/static/js/bundle.min.js',
]

// El tunel de Cloudflare cambia de URL cada vez que se reinicia.
// Leerla de una variable de entorno permite actualizarla en
// Vercel sin tocar el codigo ni volver a desplegar a mano.
const DEFAULT_HOST =
  process.env.NEXT_PUBLIC_LANGFLOW_HOST ??
  'https://rescue-adipex-cash-probe.trycloudflare.com'

const DEFAULT_FLOW =
  process.env.NEXT_PUBLIC_LANGFLOW_FLOW_ID ??
  'eee75542-fc3b-4887-99b9-eece248ecc9d'

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
  flowId = DEFAULT_FLOW,
  hostUrl = DEFAULT_HOST,
  title = 'AgroBot STEAM',
}: {
  flowId?: string
  hostUrl?: string
  title?: string
}) {
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function init() {
      // Si ya esta definido (por ejemplo tras un remontaje), listo.
      if (customElements.get('langflow-chat')) {
        if (!cancelled) setReady(true)
        return
      }

      // Si el script ya se inyecto antes, solo esperar.
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
    />
  )
}