// FILE LOCATION: components/HeatMap.tsx
//
// Interpolated plantation heat map.
//
// Two kinds of interpolation happen here, and they are separate:
//
//  1. SPATIAL - Inverse Distance Weighting. You measure at ~9
//     points but need a value at every pixel. Each pixel is a
//     weighted average of all nodes, nearer ones counting more
//     (weight = 1 / distance^POWER).
//
//  2. COLOUR - OKLab. Blending colours in plain RGB passes
//     through muddy dead zones (halfway between orange and
//     green is a dull olive). OKLab is built so equal numeric
//     steps look like equal visual steps, so gradients come out
//     smooth and vivid instead of banded and grey.
//
// Performance: the colour ramp is baked into a 256-entry lookup
// table once, and the surface is computed at low resolution then
// scaled up with the browser's smoothing.

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export type NodeReading = {
  node_id: string
  short_id: string
  label: string | null
  lat: number
  lng: number
  recorded_at: string
  is_demo?: boolean
  soil_moisture: number | null
  soil_ph: number | null
  soil_ec: number | null
  nitrogen: number | null
  phosphorus: number | null
  potassium: number | null
  air_temp_c: number | null
  air_humidity: number | null
  soil_temp_c: number | null
}

type RGB = [number, number, number]
type Stop = [number, RGB]

// =============================================================
// OKLab colour conversion
// Reference: Bjorn Ottosson's OKLab specification.
// =============================================================

function srgbToLinear(c: number): number {
  const x = c / 255
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
}

function linearToSrgb(c: number): number {
  const x =
    c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055
  return Math.round(Math.max(0, Math.min(1, x)) * 255)
}

function rgbToOklab([r, g, b]: RGB): RGB {
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb

  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)

  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ]
}

function oklabToRgb([L, a, b]: RGB): RGB {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b

  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_

  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]
}

// Smootherstep: 6t^5 - 15t^4 + 10t^3.
// Eases in and out of every ramp stop, so there is no visible
// kink where two segments meet.
function smootherstep(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

// =============================================================
// Colour ramps
// Chosen so that each one is monotonic in lightness - it stays
// readable in greyscale and for colour-blind viewers, which
// matters if your slides get printed.
// =============================================================

const RAMP_MOISTURE: Stop[] = [
  [0.0, [124, 45, 18]], // seco crítico
  [0.25, [194, 65, 12]],
  [0.5, [234, 179, 8]],
  [0.75, [77, 124, 15]],
  [1.0, [20, 83, 45]], // saturado
]

const RAMP_TEMP: Stop[] = [
  [0.0, [30, 64, 175]], // frío
  [0.3, [56, 189, 248]],
  [0.55, [250, 204, 21]],
  [0.78, [249, 115, 22]],
  [1.0, [153, 27, 27]], // calor extremo
]

const RAMP_NUTRIENT: Stop[] = [
  [0.0, [254, 243, 199]], // deficiente
  [0.45, [132, 204, 22]],
  [1.0, [20, 83, 45]], // óptimo
]

const RAMP_PH: Stop[] = [
  [0.0, [190, 24, 93]], // ácido
  [0.5, [22, 163, 74]], // ideal ~6.5
  [1.0, [67, 56, 202]], // alcalino
]

// -------------------------------------------------------------
// Bake a ramp into a 256-entry table of RGB bytes.
// Done once per ramp, then every pixel is just an array lookup
// instead of a full colour-space conversion.
// -------------------------------------------------------------
const LUT_SIZE = 256
const lutCache = new Map<Stop[], Uint8ClampedArray>()

function getLUT(stops: Stop[]): Uint8ClampedArray {
  const cached = lutCache.get(stops)
  if (cached) return cached

  const labStops: [number, RGB][] = stops.map(([p, c]) => [p, rgbToOklab(c)])
  const lut = new Uint8ClampedArray(LUT_SIZE * 3)

  for (let i = 0; i < LUT_SIZE; i++) {
    const t = i / (LUT_SIZE - 1)

    let seg = labStops.length - 2
    for (let k = 0; k < labStops.length - 1; k++) {
      if (t <= labStops[k + 1][0]) {
        seg = k
        break
      }
    }

    const [p0, c0] = labStops[seg]
    const [p1, c1] = labStops[seg + 1]
    const raw = p1 === p0 ? 0 : (t - p0) / (p1 - p0)
    const f = smootherstep(Math.max(0, Math.min(1, raw)))

    const lab: RGB = [
      c0[0] + (c1[0] - c0[0]) * f,
      c0[1] + (c1[1] - c0[1]) * f,
      c0[2] + (c1[2] - c0[2]) * f,
    ]
    const [r, g, b] = oklabToRgb(lab)

    lut[i * 3] = r
    lut[i * 3 + 1] = g
    lut[i * 3 + 2] = b
  }

  lutCache.set(stops, lut)
  return lut
}

// =============================================================
// Metrics
// min/max are fixed on purpose. Auto-scaling to the data would
// make colours shift when nothing physically changed, which is
// misleading. Set these to real agronomic thresholds once you
// have field data.
// =============================================================

type MetricKey =
  | 'soil_moisture'
  | 'air_temp_c'
  | 'soil_ph'
  | 'nitrogen'
  | 'phosphorus'
  | 'potassium'

type MetricConfig = {
  label: string
  unit: string
  min: number
  max: number
  ramp: Stop[]
  // Band the value should ideally sit in. Drawn on the legend
  // so the colour scale has a reference point - otherwise the
  // reader cannot tell whether "more green" means "better".
  ideal: [number, number]
}

const METRICS: Record<MetricKey, MetricConfig> = {
  soil_moisture: {
    label: 'Humedad',
    unit: '%',
    min: 30,
    max: 65,
    ramp: RAMP_MOISTURE,
    ideal: [42, 58],
  },
  air_temp_c: {
    label: 'Temperatura',
    unit: '°C',
    min: 24,
    max: 36,
    ramp: RAMP_TEMP,
    ideal: [25, 30],
  },
  soil_ph: {
    label: 'pH',
    unit: '',
    min: 5.5,
    max: 7.5,
    ramp: RAMP_PH,
    ideal: [6.0, 7.0],
  },
  nitrogen: {
    label: 'Nitrógeno',
    unit: 'mg/kg',
    min: 30,
    max: 120,
    ramp: RAMP_NUTRIENT,
    ideal: [70, 115],
  },
  phosphorus: {
    label: 'Fósforo',
    unit: 'mg/kg',
    min: 10,
    max: 50,
    ramp: RAMP_NUTRIENT,
    ideal: [25, 45],
  },
  potassium: {
    label: 'Potasio',
    unit: 'mg/kg',
    min: 80,
    max: 230,
    ramp: RAMP_NUTRIENT,
    ideal: [130, 215],
  },
}

// =============================================================
// Tuning knobs
// =============================================================
const GRID_W = 180 // resolution the surface is computed at
const GRID_H = 135
const POWER = 2.4 // IDW exponent: 2 = soft, 4 = sharp blobs
const CONTRAST = 1.2 // 1 = linear, higher pushes toward the extremes

// Grid mode: how many zones the field is divided into.
// 12 x 9 matches the 800x600 canvas, so cells come out square.
const CELL_COLS = 12
const CELL_ROWS = 9

type ViewMode = 'gradient' | 'grid'

// Shared IDW evaluation, used by both view modes.
function idwAt(
  lat: number,
  lng: number,
  points: NodeReading[],
  metric: MetricKey
): number {
  let weightedSum = 0
  let weightTotal = 0

  for (const p of points) {
    const value = p[metric] as number
    const dLat = lat - p.lat
    const dLng = lng - p.lng
    const d2 = dLat * dLat + dLng * dLng

    if (d2 < 1e-12) return value
    const w = 1 / Math.pow(d2, POWER / 2)
    weightedSum += value * w
    weightTotal += w
  }
  return weightedSum / weightTotal
}

// Normalise a raw value to 0-1 and apply the S-curve contrast.
function normalise(v: number, cfg: MetricConfig): number {
  let t = (v - cfg.min) / (cfg.max - cfg.min)
  t = Math.max(0, Math.min(1, t))
  return t < 0.5
    ? 0.5 * Math.pow(t * 2, CONTRAST)
    : 1 - 0.5 * Math.pow((1 - t) * 2, CONTRAST)
}

export default function HeatMap({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: NodeReading[]
  selectedId?: string | null
  onSelect?: (id: string | null) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [metric, setMetric] = useState<MetricKey>('soil_moisture')
  const [view, setView] = useState<ViewMode>('grid')

  const cfg = METRICS[metric]
  const lut = useMemo(() => getLUT(cfg.ramp), [cfg.ramp])

  const points = useMemo(
    () => nodes.filter((n) => n[metric] !== null && n[metric] !== undefined),
    [nodes, metric]
  )

  const bounds = useMemo(() => {
    if (points.length === 0) return null
    const lats = points.map((p) => p.lat)
    const lngs = points.map((p) => p.lng)
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)

    const padLat = (maxLat - minLat || 0.002) * 0.3
    const padLng = (maxLng - minLng || 0.002) * 0.3

    return {
      minLat: minLat - padLat,
      maxLat: maxLat + padLat,
      minLng: minLng - padLng,
      maxLng: maxLng + padLng,
    }
  }, [points])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!bounds || points.length === 0) return

    const spanLat = bounds.maxLat - bounds.minLat
    const spanLng = bounds.maxLng - bounds.minLng

    if (view === 'gradient') {
      // ---- GRADIENT MODE ----
      // Compute the surface at low resolution, then let the
      // browser scale it up with smoothing.
      const off = document.createElement('canvas')
      off.width = GRID_W
      off.height = GRID_H
      const octx = off.getContext('2d')
      if (!octx) return

      const img = octx.createImageData(GRID_W, GRID_H)

      for (let y = 0; y < GRID_H; y++) {
        const lat = bounds.maxLat - (y / (GRID_H - 1)) * spanLat

        for (let x = 0; x < GRID_W; x++) {
          const lng = bounds.minLng + (x / (GRID_W - 1)) * spanLng
          const t = normalise(idwAt(lat, lng, points, metric), cfg)

          const li = Math.round(t * (LUT_SIZE - 1)) * 3
          const i = (y * GRID_W + x) * 4
          img.data[i] = lut[li]
          img.data[i + 1] = lut[li + 1]
          img.data[i + 2] = lut[li + 2]
          img.data[i + 3] = 255
        }
      }

      octx.putImageData(img, 0, 0)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(off, 0, 0, canvas.width, canvas.height)
    } else {
      // ---- GRID MODE ----
      // One flat colour per zone, sampled at the cell's centre.
      // Reads as discrete management zones rather than a
      // continuous surface - closer to how a farmer would
      // actually divide a plot for irrigation.
      const cw = canvas.width / CELL_COLS
      const ch = canvas.height / CELL_ROWS

      for (let row = 0; row < CELL_ROWS; row++) {
        const lat = bounds.maxLat - ((row + 0.5) / CELL_ROWS) * spanLat

        for (let col = 0; col < CELL_COLS; col++) {
          const lng = bounds.minLng + ((col + 0.5) / CELL_COLS) * spanLng
          const raw = idwAt(lat, lng, points, metric)
          const t = normalise(raw, cfg)

          const li = Math.round(t * (LUT_SIZE - 1)) * 3
          const r = lut[li]
          const g = lut[li + 1]
          const b = lut[li + 2]

          ctx.fillStyle = `rgb(${r},${g},${b})`
          ctx.fillRect(col * cw, row * ch, cw, ch)

          // hairline gap so the zones read as separate blocks
          ctx.strokeStyle = 'rgba(255,255,255,0.55)'
          ctx.lineWidth = 1
          ctx.strokeRect(col * cw, row * ch, cw, ch)

          // value label, in whichever of black/white contrasts
          const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
          ctx.fillStyle =
            lum > 0.55 ? 'rgba(0,0,0,0.62)' : 'rgba(255,255,255,0.82)'
          ctx.font = '500 11px system-ui, sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(
            raw.toFixed(cfg.unit === '' ? 1 : 0),
            col * cw + cw / 2,
            row * ch + ch / 2
          )
        }
      }
    }

    // ---- 3. node markers ----
    for (const p of points) {
      const sx = ((p.lng - bounds.minLng) / spanLng) * canvas.width
      const sy = ((bounds.maxLat - p.lat) / spanLat) * canvas.height
      const isSel = p.node_id === selectedId
      const rad = isSel ? 15 : 11

      // soft shadow so markers read against any colour underneath
      ctx.beginPath()
      ctx.arc(sx, sy, rad + 2, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0,0,0,0.18)'
      ctx.fill()

      // outer ring on the selected node
      if (isSel) {
        ctx.beginPath()
        ctx.arc(sx, sy, rad + 5, 0, Math.PI * 2)
        ctx.lineWidth = 3
        ctx.strokeStyle = '#F4A261'
        ctx.stroke()
      }

      ctx.beginPath()
      ctx.arc(sx, sy, rad, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.96)'
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = isSel ? '#1B4332' : 'rgba(20,40,30,0.75)'
      ctx.stroke()

      ctx.fillStyle = '#14281E'
      ctx.font = (isSel ? '700 12px ' : '600 11px ') + 'system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(p.short_id, sx, sy)
    }
  }, [points, bounds, metric, cfg, lut, view, selectedId])

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas || !bounds) return
    const rect = canvas.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height

    const spanLat = bounds.maxLat - bounds.minLat
    const spanLng = bounds.maxLng - bounds.minLng

    let best: NodeReading | null = null
    let bestD = Infinity
    for (const p of points) {
      const sx = ((p.lng - bounds.minLng) / spanLng) * canvas.width
      const sy = ((bounds.maxLat - p.lat) / spanLat) * canvas.height
      const d = (sx - x) ** 2 + (sy - y) ** 2
      if (d < bestD) {
        bestD = d
        best = p
      }
    }
    onSelect?.(bestD < 45 * 45 ? (best?.node_id ?? null) : null)
  }

  // Legend gradient sampled straight from the LUT, so it always
  // matches the map exactly.
  const legendCss = useMemo(() => {
    const steps: string[] = []
    for (let i = 0; i <= 16; i++) {
      const idx = Math.round((i / 16) * (LUT_SIZE - 1)) * 3
      steps.push(
        `rgb(${lut[idx]},${lut[idx + 1]},${lut[idx + 2]}) ${(i / 16) * 100}%`
      )
    }
    return `linear-gradient(to top, ${steps.join(', ')})`
  }, [lut])

  // Where the ideal band sits on the legend, as a percentage
  // from the bottom. Uses the same normalise() as the map, so
  // the marker lines up with the colours exactly.
  const idealBand = useMemo(() => {
    const [lo, hi] = cfg.ideal
    const bottom = normalise(lo, cfg) * 100
    const top = normalise(hi, cfg) * 100
    return { bottom, height: Math.max(top - bottom, 1.5), mid: (bottom + top) / 2 }
  }, [cfg])

  if (nodes.length === 0) {
    return (
      <div className="rounded-xl bg-white p-6">
        <p className="text-sm text-neutral-600">
          Todavía no hay nodos con lecturas.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-white p-5">
      {/* ---- controls ---- */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Vista
          </span>
          <div className="inline-flex overflow-hidden rounded-lg border border-neutral-300">
            {(
              [
                ['grid', 'Cuadrícula'],
                ['gradient', 'Gradiente'],
              ] as [ViewMode, string][]
            ).map(([v, lbl]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={
                  'px-4 py-1.5 text-sm font-medium transition ' +
                  (view === v
                    ? 'bg-[#1B4332] text-white'
                    : 'bg-white text-neutral-700 hover:bg-neutral-50')
                }
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(METRICS) as MetricKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setMetric(k)}
              className={
                'rounded-full px-3 py-1.5 text-sm transition ' +
                (metric === k
                  ? 'bg-[#1B4332] text-white'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200')
              }
            >
              {METRICS[k].label}
            </button>
          ))}
        </div>
      </div>

      {/* ---- map + vertical legend ---- */}
      <div className="mx-auto flex w-full items-stretch gap-3">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          onClick={handleClick}
          className="h-auto min-w-0 flex-1 cursor-pointer rounded-lg"
        />

        <div className="flex w-20 shrink-0 flex-col items-end py-0.5">
          <span className="pr-[26px] text-[11px] tabular-nums leading-none text-neutral-600">
            {cfg.max}
            {cfg.unit}
          </span>

          <div className="relative my-2 flex-1 pr-[26px]">
            <div
              className="h-full w-3 rounded-full ring-1 ring-black/10"
              style={{ background: legendCss }}
            />

            {/* ideal band outline */}
            <div
              className="pointer-events-none absolute w-3 rounded-[3px] border-2 border-white/85"
              style={{
                right: 26,
                bottom: `${idealBand.bottom}%`,
                height: `${idealBand.height}%`,
              }}
            />

            {/* arrow + label pointing at the middle of that band */}
            <div
              className="pointer-events-none absolute flex items-center gap-1"
              style={{
                left: 18,
                bottom: `calc(${idealBand.mid}% - 7px)`,
              }}
              title={`Rango ideal: ${cfg.ideal[0]}-${cfg.ideal[1]}${cfg.unit}`}
            >
              <span className="h-0 w-0 border-y-[6px] border-r-[8px] border-y-transparent border-r-[#1B4332]" />
              <span className="text-[10px] font-medium leading-none text-[#1B4332]">
                ideal
              </span>
            </div>
          </div>

          <span className="pr-[26px] text-[11px] tabular-nums leading-none text-neutral-600">
            {cfg.min}
            {cfg.unit}
          </span>
        </div>
      </div>

    </div>
  )
}