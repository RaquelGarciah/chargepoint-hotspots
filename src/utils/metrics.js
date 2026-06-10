// ============================================================================
//  MÉTRICAS, NORMALIZACIÓN, SCORE COMBINADO Y ESCALA DE COLOR
// ============================================================================
import chroma from 'chroma-js'
import { SCORE_PARAMS } from '../dataConfig.js'

// Escala de color para fondo OSCURO: de azul apagado (bajo) a verde/ámbar/rojo
// brillante (alto). Buena legibilidad sobre el mapa dark_matter.
const COLOR_SCALE = chroma
  .scale(['#1e3a8a', '#0ea5e9', '#22c55e', '#facc15', '#f97316', '#ef4444'])
  .mode('lab')
  .domain([0, 0.25, 0.45, 0.65, 0.82, 1])

/** Color a partir de un valor normalizado [0,1]. */
export function colorFor(norm01) {
  const v = Number.isFinite(norm01) ? Math.min(1, Math.max(0, norm01)) : 0
  return COLOR_SCALE(v).hex()
}

/** Muestras de la rampa para pintar la leyenda (de menor a mayor). */
export function legendStops(n = 24) {
  return Array.from({ length: n }, (_, i) => COLOR_SCALE(i / (n - 1)).hex())
}

/** Rango (min/max) de cada métrica sobre un conjunto de puntos. */
export function metricRanges(points) {
  const keys = [
    'total_camiones',
    'avg_permanencia_min',
    'avg_conduccion_horas',
    'avg_conduccion_post_horas',
    'opportunity_score',
  ]
  const out = {}
  for (const k of keys) out[k] = minMax((points || []).map((p) => p[k]))
  return out
}

/** min / max de un array de números (ignora no-finitos). */
function minMax(values) {
  let min = Infinity
  let max = -Infinity
  for (const v of values) {
    if (!Number.isFinite(v)) continue
    if (v < min) min = v
    if (v > max) max = v
  }
  if (min === Infinity) return { min: 0, max: 0 }
  return { min, max }
}

/**
 * Normaliza un valor a [0,1] dado min/max. Si min==max devuelve 0.5
 * (varianza nula: todos iguales -> color medio, no negro ni saturado).
 */
export function norm(value, min, max) {
  if (!Number.isFinite(value)) return 0
  if (max <= min) return 0.5
  return (value - min) / (max - min)
}

/**
 * Calcula el opportunity_score "estilo notebook" para un punto agregado.
 *   t = minmax(total_camiones) sobre los puntos visibles
 *   p = min(permanencia / 45, 1)
 *   r = min(conduccion / 4.5, 1)
 *   score = 0.40 t + 0.30 p + 0.30 r
 */
export function computeOpportunity(point, trafficMin, trafficMax) {
  const t = norm(point.total_camiones, trafficMin, trafficMax)
  const p = Math.min(point.avg_permanencia_min / SCORE_PARAMS.permanenciaSat, 1)
  const r = Math.min(point.avg_conduccion_horas / SCORE_PARAMS.conduccionSat, 1)
  return (
    SCORE_PARAMS.wTrafico * t +
    SCORE_PARAMS.wPermanencia * p +
    SCORE_PARAMS.wRegulacion * r
  )
}

/**
 * Construye la "vista" de los hotspots ordenada por la métrica seleccionada.
 * Devuelve cada punto con:
 *   - value : valor crudo de la métrica elegida
 *   - norm  : ese value normalizado a [0,1] sobre el conjunto visible
 *   - color : color asociado
 *   - rank  : posición (1 = mejor)
 *
 * @param {Array} points              hotspots agregados de la ruta
 * @param {Object} opts
 * @param {string} opts.metricKey     métrica activa por la que ordenar/colorear
 */
export function buildMetricView(points, { metricKey }) {
  if (!points || points.length === 0) return []

  const r = minMax(points.map((p) => p[metricKey]))
  const enriched = points.map((p) => {
    const value = p[metricKey]
    const n = norm(value, r.min, r.max)
    return {
      ...p,
      value,
      norm: n,
      color: colorFor(n),
    }
  })

  // Ranking descendente por la métrica activa.
  enriched.sort((a, b) => b.value - a.value)
  enriched.forEach((p, i) => (p.rank = i + 1))
  return enriched
}

/**
 * Redondea hacia arriba al siguiente "nice number" (1, 2, 5, 10, 20, 50, ...).
 * Útil para topes de slider que deben ser predecibles, no el max exacto del dataset.
 */
export function niceCeil(x) {
  if (!Number.isFinite(x) || x <= 0) return 1
  const order = Math.pow(10, Math.floor(Math.log10(x)))
  const m = x / order
  const nice = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10
  return nice * order
}

/**
 * Tope superior del slider de filtros para una métrica dada. Va más allá del
 * max real de los datos para que se pueda filtrar también por umbrales por
 * encima de cualquier valor presente (caso "qué pasaría si exigimos ≥ X").
 *   - opportunity_score: acotado a 1 (no tiene sentido pedir más).
 *   - resto: ~2 × max real, redondeado al siguiente nice number.
 */
export function filterSliderCeiling(metricKey, dataMax) {
  if (metricKey === 'opportunity_score') return 1
  if (!Number.isFinite(dataMax) || dataMax <= 0) return 1
  return niceCeil(dataMax * 2)
}

/** Radio del marcador (px) a partir del valor normalizado. */
export function radiusFor(norm01, { min = 8, max = 30 } = {}) {
  const v = Number.isFinite(norm01) ? Math.min(1, Math.max(0, norm01)) : 0
  // raíz para que el área crezca de forma perceptiva, no lineal abrupta.
  return min + (max - min) * Math.sqrt(v)
}

/** Formatea un valor de métrica para mostrar. */
export function formatMetric(value, metric) {
  if (value == null || !Number.isFinite(value)) return '—'
  if (metric.key === 'opportunity_score') return value.toFixed(3)
  if (metric.key === 'total_camiones') return Math.round(value).toLocaleString('es-ES')
  return value.toLocaleString('es-ES', { maximumFractionDigits: 1 })
}
