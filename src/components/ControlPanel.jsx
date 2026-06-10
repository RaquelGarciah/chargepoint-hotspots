// Panel de control: ámbito, métrica, filtros, capas y tema.
// (La leyenda de colores vive ahora sobre el mapa, no aquí.)
import { METRICS, POI_COLORS } from '../dataConfig.js'
import { formatMetric } from '../utils/metrics.js'

export default function ControlPanel({
  routes,
  scope,
  onScopeChange,
  selectedRoute,
  onRouteChange,
  theme,
  onThemeChange,
  metricKey,
  onMetricChange,
  topN,
  onTopNChange,
  showFuel,
  onToggleFuel,
  showIndustrial,
  onToggleIndustrial,
  hasPois,
  filters,
  filterMax,
  onFilterChange,
  onResetFilters,
  hasGeometry,
}) {
  const isGlobal = scope === 'global'
  const filtersActive = METRICS.some((m) => (filters[m.key] || 0) > 0)

  return (
    <div className="panel">
      <header className="panel-brand">
        <div>
          <h1>Hotspots</h1>
          <p>Ubicación óptima de puntos de recarga</p>
        </div>
      </header>

      {/* ÁMBITO + TEMA */}
      <section className="control-block">
        <div className="control-label-row">
          <span className="control-label">Ámbito</span>
          <div className="toggle">
            <button
              className={!isGlobal ? 'toggle-btn active' : 'toggle-btn'}
              onClick={() => onScopeChange('route')}
            >
              Por ruta
            </button>
            <button
              className={isGlobal ? 'toggle-btn active' : 'toggle-btn'}
              onClick={() => onScopeChange('global')}
            >
              Global
            </button>
          </div>
        </div>
        {!isGlobal ? (
          <select
            className="select"
            value={selectedRoute || ''}
            onChange={(e) => onRouteChange(e.target.value)}
          >
            {routes.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        ) : (
          <p className="scope-note">
            Comparando los 15 hotspots agregados de todas las rutas.
          </p>
        )}
      </section>

      {/* COMPARAR POR */}
      <section className="control-block">
        <details className="collapsible" open>
          <summary className="control-label collapsible-trigger">
            Comparar por
          </summary>
          <div className="metric-chips">
            {METRICS.map((m) => (
              <button
                key={m.key}
                className={metricKey === m.key ? 'chip active' : 'chip'}
                onClick={() => onMetricChange(m.key)}
                title={m.description}
              >
                {m.short}
              </button>
            ))}
          </div>
        </details>
      </section>

      {/* FILTROS + DESTACAR TOP N */}
      <section className="control-block">
        <details className="collapsible">
          <summary className="control-label collapsible-trigger">
            Filtros
            {filtersActive && (
              <span
                className="filters-active-dot"
                aria-label="filtros activos"
              />
            )}
          </summary>
          {filtersActive && (
            <div className="control-label-row reset-row">
              <button className="link-btn" onClick={onResetFilters}>
                Restablecer filtros
              </button>
            </div>
          )}
          <div className="filters">
          {/* Destacar Top-N: misma estructura visual que un slider de filtro
              pero con barra de acento a la izquierda para diferenciar. */}
          <div className="weight-row row-highlight">
            <div className="weight-head">
              <span>Destacar top</span>
              <span className="weight-val">{topN}</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={topN}
              onChange={(e) => onTopNChange(parseInt(e.target.value, 10))}
            />
          </div>
          {METRICS.map((m) => {
            const max = filterMax?.[m.key] || 0
            const val = filters[m.key] || 0
            // Step adaptativo al rango — un step fijo de 0.5 inutilizaba el
            // slider en métricas con max < 1 (p.ej. conducción 0–0,6 h).
            const step =
              m.key === 'opportunity_score'
                ? 0.01
                : max > 100
                  ? 5
                  : max > 20
                    ? 1
                    : max > 5
                      ? 0.5
                      : max > 1
                        ? 0.1
                        : 0.02
            return (
              <div className="weight-row" key={m.key}>
                <div className="weight-head">
                  <span>{m.short}</span>
                  <span className="weight-val">
                    {val > 0 ? `≥ ${formatMetric(val, m)}` : 'todos'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={max || 1}
                  step={step}
                  value={val}
                  onChange={(e) =>
                    onFilterChange(m.key, parseFloat(e.target.value))
                  }
                />
              </div>
            )
          })}
        </div>
        </details>
      </section>

      {/* CAPAS DE CONTEXTO */}
      <section className="control-block">
        <span className="control-label">Capas de contexto</span>
        <label className="layer-toggle">
          <input
            type="checkbox"
            checked={showFuel}
            onChange={(e) => onToggleFuel(e.target.checked)}
          />
          <span className="swatch" style={{ background: POI_COLORS.fuel }} />
          Gasolineras
        </label>
        <label className="layer-toggle">
          <input
            type="checkbox"
            checked={showIndustrial}
            onChange={(e) => onToggleIndustrial(e.target.checked)}
          />
          <span
            className="swatch"
            style={{ background: POI_COLORS.industrial }}
          />
          Polígonos industriales
        </label>
        {isGlobal && (
          <p className="scope-note">
            En modo global se muestran todas las gasolineras y polígonos.
          </p>
        )}
        {!hasPois && (
          <p className="scope-note">
            Sin datos de POIs (ejecuta scripts/fetch_pois.mjs).
          </p>
        )}
      </section>

      {/* APARIENCIA */}
      <section className="control-block">
        <div className="control-label-row">
          <span className="control-label">Mapa</span>
          <div className="toggle">
            <button
              className={theme === 'dark' ? 'toggle-btn active' : 'toggle-btn'}
              onClick={() => onThemeChange('dark')}
            >
              Oscuro
            </button>
            <button
              className={theme === 'light' ? 'toggle-btn active' : 'toggle-btn'}
              onClick={() => onThemeChange('light')}
            >
              Claro
            </button>
          </div>
        </div>
      </section>

      {!hasGeometry && (
        <div className="warning">
          Geometría de ruta pendiente (columna WKT). Las líneas aparecerán
          cuando el CSV de rutas la incluya.
        </div>
      )}
    </div>
  )
}
