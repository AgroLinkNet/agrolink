// FILE LOCATION: components/AgroBot.tsx
//
// Envuelve el web component <langflow-chat> para usarlo en React.
//
// Un web component no existe hasta que su script lo define. Por
// eso el snippet suelto no renderiza nada: falta cargar el
// bundle desde el CDN primero.
'use client'

import { useEffect, useState } from 'react'

const SCRIPT_SRC =
  'https://cdn.jsdelivr.net/gh/logspace-ai/langflow-embedded-chat@main/dist/build/static/js/bundle.min.js'

// El elemento no es JSX estándar, así que lo tipamos a mano.
// Evita declarar cosas en el namespace global de JSX, que en
// React 19 cambió de lugar y rompe según la versión.
const LangflowChat = 'langflow-chat' as unknown as React.FC<{
  flow_id: string
  host_url: string
  window_title?: string
  chat_position?: string
  additional_headers?: string
  api_key?: string
}>

export default function AgroBot({
  flowId = 'eee75542-fc3b-4887-99b9-eece248ecc9d',
  hostUrl = 'https://route-received-envelope-mph.trycloudflare.com',
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

    function markReady() {
      customElements.whenDefined('langflow-chat').then(() => {
        if (!cancelled) setReady(true)
      })
    }

    // No cargar el script dos veces si el componente se remonta
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="langflow-embedded-chat"]'
    )

    if (existing) {
      markReady()
      return
    }

    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = markReady
    script.onerror = () => {
      if (!cancelled) setFailed(true)
    }
    document.body.appendChild(script)

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
          No se pudo cargar el widget del asistente. Verificá que el servidor
          de Langflow esté activo.
        </p>
      </div>
    )
  }

  return (
    <>
      {!ready && (
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <p className="text-sm text-neutral-500">Cargando asistente...</p>
        </div>
      )}

      {ready && (
        <LangflowChat
          flow_id={flowId}
          host_url={hostUrl}
          window_title={title}
          chat_position="bottom-right"
          // ngrok gratuito interpone una página de advertencia en
          // las peticiones del navegador. Esta cabecera la saltea.
          additional_headers='{"ngrok-skip-browser-warning":"true"}'
        />
      )}
    </>
  )
}
