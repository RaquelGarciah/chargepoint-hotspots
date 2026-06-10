// Ficha completa de un hotspot (se muestra dentro del Popup de Leaflet).
import { METRICS } from '../dataConfig.js'
import { formatMetric, norm, colorFor } from '../utils/metrics.js'

// Lista de orígenes/destinos ya agregada en useData: [{ place, count, pct }].
// `pct` es el % de camiones de ese lugar respecto al total del hotspot.
function ODColumn({ title, items }) {
  if (!items || items.length === 0) return null
  return (
    <div className="popup-od-col">
      <div className="popup-od-title">{title}</div>
      <ul>
        {items.map((it, i) => (
          <li key={i}>
            <span className="od-place">{it.place}</span>
            <span className="od-count">
              {it.count}
              {it.pct != null && (
                <span className="od-pct"> · {it.pct.toFixed(0)}%</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function MetricBar({ metric, value, ranges }) {
  const r = ranges?.[metric.key] || { min: 0, max: 0 }
  const n = norm(value, r.min, r.max)
  return (
    <div className="popup-metric">
      <div className="popup-metric-head">
        <span className="popup-metric-label">{metric.short}</span>
        <span className="popup-metric-value">
          {formatMetric(value, metric)}
          {metric.unit ? <span className="unit"> {metric.unit}</span> : null}
        </span>
      </div>
      <div className="popup-bar-track">
        <div
          className="popup-bar-fill"
          style={{ width: `${Math.max(4, n * 100)}%`, background: colorFor(n) }}
        />
      </div>
    </div>
  )
}

export default function HotspotPopup({ point, ranges }) {
  if (!point) return null
  const origins = point.top_origins || []
  const destinations = point.top_destinations || []

  return (
    <div className="popup">
      {point.rank ? (
        <div className="popup-header">
          <span className="popup-rank">#{point.rank}</span>
        </div>
      ) : null}

      <div className="popup-coords">
        {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}
      </div>

      <div className="popup-metrics">
        {METRICS.map((m) => (
          <MetricBar key={m.key} metric={m} value={point[m.key]} ranges={ranges} />
        ))}
      </div>

      {(origins.length > 0 || destinations.length > 0) && (
        <div className="popup-od">
          <ODColumn title="Top orígenes" items={origins} />
          <ODColumn title="Top destinos" items={destinations} />
        </div>
      )}
    </div>
  )
}
