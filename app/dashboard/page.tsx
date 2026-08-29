// FILE LOCATION: app/dashboard/page.tsx
//
// Requires components/HeatMap.tsx (v5 - controlled selection).

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import HeatMap, { type NodeReading } from '@/components/HeatMap'
import AgroBot from '@/components/AgroBot'

type Farm = { id: string; name: string }
type Layout = 'stacked' | 'side'

// =============================================================
// Agronomic thresholds
//
// Placeholders based on general ranges - replace with values
// you can cite for your crop and soil type before the thesis
// is final. A judge may well ask where these come from.
// =============================================================

type Level = 'ok' | 'warn' | 'crit'

function worse(a: Level, b: Level): Level {
  const rank = { ok: 0, warn: 1, crit: 2 }
  return rank[a] >= rank[b] ? a : b
}

// Ranges are [criticalLow, warnLow, warnHigh, criticalHigh].
function band(
  value: number | null,
  [critLow, warnLow, warnHigh, critHigh]: [number, number, number, number]
): Level {
  if (value === null || value === undefined) return 'ok'
  if (value < critLow || value > critHigh) return 'crit'
  if (value < warnLow || value > warnHigh) return 'warn'
  return 'ok'
}

function levelMoisture(v: number | null): Level {
  return band(v, [32, 38, 62, 70])
}
function levelPh(v: number | null): Level {
  return band(v, [5.5, 6.0, 7.0, 7.6])
}
function levelTemp(v: number | null): Level {
  return band(v, [-99, -99, 32, 35])
}
function levelNitrogen(v: number | null): Level {
  return band(v, [40, 60, 9999, 9999])
}

function rowLevel(r: NodeReading): Level {
  return [
    levelMoisture(r.soil_moisture),
    levelPh(r.soil_ph),
    levelTemp(r.air_temp_c),
    levelNitrogen(r.nitrogen),
  ].reduce(worse, 'ok')
}

function rowReasons(r: NodeReading): string[] {
  const reasons: string[] = []
  if (levelMoisture(r.soil_moisture) !== 'ok')
    reasons.push(
      (r.soil_moisture ?? 0) < 38 ? 'Riego necesario' : 'Exceso de agua'
    )
  if (levelPh(r.soil_ph) !== 'ok')
    reasons.push((r.soil_ph ?? 0) < 6 ? 'Suelo ácido' : 'Suelo alcalino')
  if (levelTemp(r.air_temp_c) !== 'ok') reasons.push('Calor alto')
  if (levelNitrogen(r.nitrogen) !== 'ok') reasons.push('Nitrógeno bajo')
  return reasons
}

// -------------------------------------------------------------
// Recommendations
//
// These are generic agronomic responses. Before the thesis is
// final, tie each one to a source and to your specific crop -
// "aplicar cal agrícola" is correct in general but the rate
// depends on soil texture and buffer capacity.
// -------------------------------------------------------------
type Recommendation = { level: Level; title: string; detail: string }

function recommendations(r: NodeReading): Recommendation[] {
  const out: Recommendation[] = []

  const m = levelMoisture(r.soil_moisture)
  if (m !== 'ok') {
    if ((r.soil_moisture ?? 0) < 38) {
      out.push({
        level: m,
        title: m === 'crit' ? 'Regar con urgencia' : 'Programar riego',
        detail:
          m === 'crit'
            ? 'Humedad por debajo del punto crítico. Regar dentro de las próximas horas para evitar estrés hídrico.'
            : 'Humedad acercándose al límite inferior. Programar riego en las próximas 24 horas.',
      })
    } else {
      out.push({
        level: m,
        title: 'Suspender riego',
        detail:
          'Exceso de agua en la zona. Suspender el riego y verificar el drenaje; el encharcamiento reduce el oxígeno disponible en la raíz.',
      })
    }
  }

  const p = levelPh(r.soil_ph)
  if (p !== 'ok') {
    if ((r.soil_ph ?? 0) < 6) {
      out.push({
        level: p,
        title: 'Corregir acidez',
        detail:
          'Suelo ácido. Considerar encalado. En suelos ácidos el fósforo se fija y queda menos disponible para la planta.',
      })
    } else {
      out.push({
        level: p,
        title: 'Corregir alcalinidad',
        detail:
          'Suelo alcalino. Incorporar materia orgánica o azufre elemental. A pH alto el hierro y el zinc se vuelven poco disponibles.',
      })
    }
  }

  const t = levelTemp(r.air_temp_c)
  if (t !== 'ok') {
    out.push({
      level: t,
      title: 'Mitigar el calor',
      detail:
        'Temperatura elevada. Evitar riego en las horas de máxima insolación y considerar cobertura o sombreado en esta zona.',
    })
  }

  const n = levelNitrogen(r.nitrogen)
  if (n !== 'ok') {
    out.push({
      level: n,
      title: 'Reponer nitrógeno',
      detail:
        'Nitrógeno por debajo del rango objetivo. Evaluar fertilización nitrogenada dirigida solo a esta zona, no a toda la parcela.',
    })
  }

  return out
}

// -------------------------------------------------------------
// Styling
// -------------------------------------------------------------
const ROW_BG: Record<Level, string> = {
  ok: 'bg-white',
  warn: 'bg-[#FEF8EC]',
  crit: 'bg-[#FDF1ED]',
}

const CELL_TEXT: Record<Level, string> = {
  ok: 'text-neutral-900',
  warn: 'font-semibold text-[#8A5A12]',
  crit: 'font-semibold text-[#8C2F16]',
}

const PILL: Record<Level, string> = {
  ok: 'bg-[#DCF0E1] text-[#1B4332]',
  warn: 'bg-[#FAECC9] text-[#7A5312]',
  crit: 'bg-[#F8DAD2] text-[#8C2F16]',
}

const PILL_LABEL: Record<Level, string> = {
  ok: 'Todo bien',
  warn: 'Atención',
  crit: 'Crítico',
}

const REASON_TEXT: Record<Level, string> = {
  ok: 'text-neutral-500',
  warn: 'text-[#7A5312]',
  crit: 'text-[#8C2F16]',
}

const REC_BORDER: Record<Level, string> = {
  ok: 'border-[#CFE5D5]',
  warn: 'border-[#F0DCAE]',
  crit: 'border-[#EFC9BC]',
}

// =============================================================
// Detail panel
// =============================================================
function NodeDetail({
  node,
  onClear,
}: {
  node: NodeReading | null
  onClear: () => void
}) {
  if (!node) {
    return (
      <div className="flex h-full min-h-[220px] items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-white/60 p-6">
        <p className="max-w-[240px] text-center text-sm text-neutral-500">
          Seleccioná un nodo en el mapa o en la tabla para ver su detalle y las
          recomendaciones de esa zona.
        </p>
      </div>
    )
  }

  const lvl = rowLevel(node)
  const recs = recommendations(node)
  
  const metrics: [string, string, Level][] = [
    [
      'Humedad del suelo',
      node.soil_moisture != null ? node.soil_moisture.toFixed(1) + '%' : '—',
      levelMoisture(node.soil_moisture),
    ],
    [
      'pH',
      node.soil_ph != null ? node.soil_ph.toFixed(1) : '—',
      levelPh(node.soil_ph),
    ],
    [
      'Nitrógeno',
      node.nitrogen != null ? node.nitrogen.toFixed(0) + ' mg/kg' : '—',
      levelNitrogen(node.nitrogen),
    ],
    [
      'Fósforo',
      node.phosphorus != null ? node.phosphorus.toFixed(0) + ' mg/kg' : '—',
      'ok',
    ],
    [
      'Potasio',
      node.potassium != null ? node.potassium.toFixed(0) + ' mg/kg' : '—',
      'ok',
    ],
    [
      'Temp. aire',
      node.air_temp_c != null ? node.air_temp_c.toFixed(1) + '°C' : '—',
      levelTemp(node.air_temp_c),
    ],
    [
      'Humedad aire',
      node.air_humidity != null ? node.air_humidity.toFixed(0) + '%' : '—',
      'ok',
    ],
  ]

  return (
    <div className="rounded-xl bg-white p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            Nodo {node.short_id}
          </p>
          <h3 className="truncate text-lg font-semibold text-[#1B4332]">
            {node.label ?? node.short_id}
          </h3>
        </div>
        <button
          onClick={onClear}
          className="shrink-0 rounded-lg border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 transition hover:bg-neutral-100"
        >
          Cerrar
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={
            'inline-block rounded-full px-2.5 py-1 text-xs font-medium ' +
            PILL[lvl]
          }
        >
          {PILL_LABEL[lvl]}
        </span>
        {node.is_demo && (
          <span className="inline-block rounded-full bg-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700">
            Simulado
          </span>
        )}
      </div>

      <dl className="mt-4 space-y-1.5 border-t border-neutral-200 pt-4">
        {metrics.map(([label, value, l]) => (
          <div key={label} className="flex items-baseline justify-between gap-3">
            <dt className="text-sm text-neutral-600">{label}</dt>
            <dd className={'text-sm tabular-nums ' + CELL_TEXT[l]}>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 border-t border-neutral-200 pt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Recomendaciones
        </p>
        {recs.length === 0 ? (
          <p className="text-sm text-neutral-600">
            Todos los valores están dentro del rango objetivo. No se requiere
            acción; continuar el monitoreo.
          </p>
        ) : (
          <div className="space-y-2.5">
            {recs.map((rec) => (
              <div
                key={rec.title}
                className={
                  'rounded-lg border-l-4 bg-neutral-50 py-2 pl-3 pr-3 ' +
                  REC_BORDER[rec.level]
                }
              >
                <p className="text-sm font-medium text-neutral-900">
                  {rec.title}
                </p>
                <p className="mt-0.5 text-sm leading-snug text-neutral-600">
                  {rec.detail}
                </p>
              </div>
            ))}
          </div>
        )}
                <AgroBot /> 

      </div>

      <p className="mt-4 text-xs text-neutral-400">
        Última lectura: {new Date(node.recorded_at).toLocaleString('es-PY')}
      </p>
    </div>
  )
}

// =============================================================
// Page
// =============================================================

<script src="https://cdn.jsdelivr.net/gh/logspace-ai/langflow-embedded-chat@main/dist/build/static/js/bundle.min.js"></script>



export default function DashboardPage() {
  const [email, setEmail] = useState('')
  const [farms, setFarms] = useState<Farm[]>([])
  const [readings, setReadings] = useState<NodeReading[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [layout, setLayout] = useState<Layout>('stacked')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setEmail(user?.email ?? '')

      // No filters anywhere. RLS decides what comes back.
      const { data: farmData, error: farmErr } = await supabase
        .from('farms')
        .select('id, name')

      const { data: readingData, error: readErr } = await supabase
        .from('latest_readings')
        .select('*')

      if (farmErr) setError('farms: ' + farmErr.message)
      if (readErr) setError((e) => e + ' | latest_readings: ' + readErr.message)

      setFarms(farmData ?? [])
      setReadings((readingData ?? []) as NodeReading[])
      setLoading(false)
    }
    load()
  }, [])

  // Numeric sort: A2 before A10.
  const sorted = useMemo(
    () =>
      [...readings].sort((a, b) =>
        a.short_id.localeCompare(b.short_id, undefined, { numeric: true })
      ),
    [readings]
  )

  const alerts = useMemo(
    () => sorted.filter((r) => rowLevel(r) !== 'ok').length,
    [sorted]
  )

  // True while any simulated node is still present. The database
  // trigger deletes these automatically once a real reading
  // arrives, so this turns itself off.
  const hasDemoData = useMemo(
    () => readings.some((r) => r.is_demo),
    [readings]
  )

  async function refreshReadings() {
    const { data } = await supabase.from('latest_readings').select('*')
    setReadings((data ?? []) as NodeReading[])
  }

  async function removeDemoData() {
    setBusy(true)
    setSelectedId(null)
    // RLS limits this to the current user's own farm.
    await supabase.from('nodes').delete().eq('is_demo', true)
    await refreshReadings()
    setBusy(false)
  }

  async function regenerateDemoData() {
    setBusy(true)
    setSelectedId(null)
    // The browser cannot insert readings directly - there is no
    // insert policy on that table, by design. This calls a
    // database function that seeds the caller's own farm.
    const { error: rpcErr } = await supabase.rpc('seed_demo_data')
    if (rpcErr) setError('seed_demo_data: ' + rpcErr.message)
    await refreshReadings()
    setBusy(false)
  }

  const selectedNode = useMemo(
    () => readings.find((r) => r.node_id === selectedId) ?? null,
    [readings, selectedId]
  )

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // -----------------------------------------------------------
  // Table card (shared by both layouts)
  // -----------------------------------------------------------
  const tableCard = (
    <div className="rounded-xl bg-white p-5">
      <h2 className="mb-4 font-medium text-[#1B4332]">
        Últimas lecturas por nodo
      </h2>

      {sorted.length === 0 ? (
        <p className="text-sm text-neutral-600">Todavía no hay lecturas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-neutral-500">
                <th className="w-[7%] pb-3 pr-3 font-medium">#</th>
                <th className="w-[18%] pb-3 pr-3 font-medium">Nodo</th>
                <th className="w-[13%] pb-3 pr-3 text-right font-medium">
                  Humedad
                </th>
                <th className="w-[10%] pb-3 pr-3 text-right font-medium">pH</th>
                <th className="w-[13%] pb-3 pr-3 text-right font-medium">N</th>
                <th className="w-[13%] pb-3 pr-5 text-right font-medium">
                  Temp.
                </th>
                <th className="pb-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const lvl = rowLevel(r)
                const isSel = r.node_id === selectedId
                const reasons = rowReasons(r)

                return (
                  <tr
                    key={r.node_id}
                    onClick={() =>
                      setSelectedId(isSel ? null : r.node_id)
                    }
                    className={
                      'cursor-pointer border-t border-neutral-200/70 align-middle transition ' +
                      ROW_BG[lvl] +
                      (isSel
                        ? ' outline outline-2 -outline-offset-2 outline-[#F4A261]'
                        : ' hover:brightness-[0.985]')
                    }
                  >
                    <td className="py-2.5 pr-3 tabular-nums text-neutral-500">
                      {r.short_id}
                    </td>
                    <td className="truncate py-2.5 pr-3 font-medium text-neutral-900">
                      {r.label ?? r.short_id}
                    </td>
                    <td
                      className={
                        'py-2.5 pr-3 text-right tabular-nums ' +
                        CELL_TEXT[levelMoisture(r.soil_moisture)]
                      }
                    >
                      {r.soil_moisture?.toFixed(1) ?? '—'}%
                    </td>
                    <td
                      className={
                        'py-2.5 pr-3 text-right tabular-nums ' +
                        CELL_TEXT[levelPh(r.soil_ph)]
                      }
                    >
                      {r.soil_ph?.toFixed(1) ?? '—'}
                    </td>
                    <td
                      className={
                        'py-2.5 pr-3 text-right tabular-nums ' +
                        CELL_TEXT[levelNitrogen(r.nitrogen)]
                      }
                    >
                      {r.nitrogen?.toFixed(0) ?? '—'}
                    </td>
                    <td
                      className={
                        'py-2.5 pr-5 text-right tabular-nums ' +
                        CELL_TEXT[levelTemp(r.air_temp_c)]
                      }
                    >
                      {r.air_temp_c?.toFixed(1) ?? '—'}°C
                    </td>
                    <td className="py-2.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span
                          className={
                            'inline-block shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ' +
                            PILL[lvl]
                          }
                        >
                          {PILL_LABEL[lvl]}
                        </span>
                        {reasons.length > 0 && (
                          <span className={'text-sm ' + REASON_TEXT[lvl]}>
                            {reasons.join(' · ')}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  const mapCard = (
    <HeatMap
      nodes={readings}
      selectedId={selectedId}
      onSelect={setSelectedId}
    />
  )

  const detailCard = (
    <NodeDetail node={selectedNode} onClear={() => setSelectedId(null)} />
  )

  return (
    <main className="min-h-screen bg-[#F7F4EF] p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1B4332]">AgroLink</h1>
            <p className="text-sm text-neutral-600">{email}</p>
          </div>
          <button
            onClick={signOut}
            className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-800 transition hover:bg-neutral-100"
          >
            Salir
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-neutral-600">Cargando...</p>
        ) : (
          <>
            {hasDemoData && (
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#F0DCAE] bg-[#FEF8EC] px-5 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#7A5312]">
                    Datos simulados
                  </p>
                  <p className="mt-0.5 text-sm text-[#8A6A2E]">
                    Estas lecturas son generadas automáticamente para
                    demostración. No provienen de sensores reales. El aviso
                    desaparece solo cuando el gateway envía su primera lectura.
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    onClick={regenerateDemoData}
                    disabled={busy}
                    className="rounded-lg border border-[#DCC38A] bg-white px-3 py-1.5 text-sm font-medium text-[#7A5312] transition hover:bg-[#FDF3DE] disabled:opacity-50"
                  >
                    {busy ? 'Generando...' : 'Regenerar'}
                  </button>
                  <button
                    onClick={removeDemoData}
                    disabled={busy}
                    className="rounded-lg border border-[#DCC38A] bg-white px-3 py-1.5 text-sm font-medium text-[#7A5312] transition hover:bg-[#FDF3DE] disabled:opacity-50"
                  >
                    Borrar
                  </button>
                </div>
              </div>
            )}

            {!hasDemoData && (
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-5 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-800">
                    Sin datos simulados
                  </p>
                  <p className="mt-0.5 text-sm text-neutral-600">
                    Podés generar una plantación de prueba con nueve nodos para
                    ver el sistema funcionando. Se marcará claramente como
                    simulada.
                  </p>
                </div>
                <button
                  onClick={regenerateDemoData}
                  disabled={busy}
                  className="shrink-0 rounded-lg bg-[#1B4332] px-3.5 py-2 text-sm font-medium text-white transition hover:bg-[#143728] disabled:opacity-50"
                >
                  {busy ? 'Generando...' : 'Generar datos simulados'}
                </button>
              </div>
            )}

            <section className="mb-6 grid grid-cols-3 gap-4">
              <div className="rounded-xl bg-white p-5">
                <p className="text-xs uppercase tracking-wide text-neutral-500">
                  Plantaciones
                </p>
                <p className="mt-1 text-2xl font-semibold text-[#1B4332]">
                  {farms.length}
                </p>
                <p className="mt-1 truncate text-sm text-neutral-700">
                  {farms.map((f) => f.name).join(', ') || '—'}
                </p>
              </div>

              <div className="rounded-xl bg-white p-5">
                <p className="text-xs uppercase tracking-wide text-neutral-500">
                  Nodos activos
                </p>
                <p className="mt-1 text-2xl font-semibold text-[#1B4332]">
                  {sorted.length}
                </p>
                <p className="mt-1 text-sm text-neutral-700">con lectura</p>
              </div>

              <div className="rounded-xl bg-white p-5">
                <p className="text-xs uppercase tracking-wide text-neutral-500">
                  Requieren atención
                </p>
                <p
                  className={
                    'mt-1 text-2xl font-semibold ' +
                    (alerts > 0 ? 'text-[#8C2F16]' : 'text-[#1B4332]')
                  }
                >
                  {alerts}
                </p>
                <p className="mt-1 text-sm text-neutral-700">
                  {alerts === 0 ? 'todo en rango' : 'zonas fuera de rango'}
                </p>
              </div>
            </section>

            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Disposición
              </span>
              <div className="inline-flex overflow-hidden rounded-lg border border-neutral-300">
                {(
                  [
                    ['stacked', 'Apilado'],
                    ['side', 'Lado a lado'],
                  ] as [Layout, string][]
                ).map(([v, lbl]) => (
                  <button
                    key={v}
                    onClick={() => setLayout(v)}
                    className={
                      'px-4 py-1.5 text-sm font-medium transition ' +
                      (layout === v
                        ? 'bg-[#1B4332] text-white'
                        : 'bg-white text-neutral-700 hover:bg-neutral-50')
                    }
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {layout === 'stacked' ? (
              // map on the left, detail fills the space on the right
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="min-w-0">{mapCard}</div>
                  <div className="min-w-0">{detailCard}</div>
                </div>
                {tableCard}
              </div>
            ) : (
              // table on the left, map and detail stacked on the right
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_460px]">
                <div className="min-w-0">{tableCard}</div>
                <div className="min-w-0 space-y-6">
                  {mapCard}
                  {detailCard}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}