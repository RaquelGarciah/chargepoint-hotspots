// Ranking de hotspots de la ruta por la métrica/score activos. Clic = fly-to.
import { motion } from 'framer-motion'
import { formatMetric } from '../utils/metrics.js'
import { METRICS } from '../dataConfig.js'

export default function RankingList({
  points,
  metricKey,
  selectedId,
  onSelect,
}) {
  const metric = METRICS.find((m) => m.key === metricKey)
  const title = metric ? metric.label : 'Métrica'

  return (
    <div className="ranking">
      <div className="ranking-head">
        <span className="ranking-title">Ranking · {title}</span>
        <span className="ranking-count">{points.length} hotspots</span>
      </div>
      <div className="ranking-list">
        {points.map((p) => {
          const display = formatMetric(p.value, metric)
          return (
            <button
              key={p.hotspot_id}
              className={
                p.hotspot_id === selectedId
                  ? 'ranking-item selected'
                  : 'ranking-item'
              }
              onClick={() => onSelect(p.hotspot_id)}
            >
              <span className="rank-pos">{p.rank}</span>
              <span className="rank-dot" style={{ background: p.color }} />
              <span className="rank-bar">
                <motion.span
                  className="rank-bar-fill"
                  style={{ background: p.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(3, p.norm * 100)}%` }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                />
              </span>
              <span className="rank-value">{display}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
