import { useEffect, useMemo, useState } from 'react'
import { useData } from './hooks/useData.js'
import { buildMetricView, metricRanges, filterSliderCeiling } from './utils/metrics.js'
import { METRICS } from './dataConfig.js'
import ControlPanel from './components/ControlPanel.jsx'
import MapView from './components/MapView.jsx'
import RankingList from './components/RankingList.jsx'

const DEFAULT_FILTERS = METRICS.reduce((acc, m) => ({ ...acc, [m.key]: 0 }), {})
const EMPTY_POIS = { fuel: [], industrial: [] }

export default function Dashboard() {
  const data = useData()

  const [scope, setScope] = useState('route') // 'route' | 'global'
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [theme, setTheme] = useState('dark')
  const [metricKey, setMetricKey] = useState('opportunity_score')
  const [topN, setTopN] = useState(3)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [showFuel, setShowFuel] = useState(true)
  const [showIndustrial, setShowIndustrial] = useState(true)
  const [selectedId, setSelectedId] = useState(null)

  const isGlobal = scope === 'global'

  useEffect(() => {
    if (!selectedRoute && data.routes.length > 0) {
      setSelectedRoute(data.routes[0])
    }
  }, [data.routes, selectedRoute])

  // Conjunto base de puntos según ámbito.
  const rawPoints = useMemo(() => {
    if (isGlobal) return data.globalHotspots || []
    return selectedRoute ? data.hotspotsByRoute[selectedRoute] || [] : []
  }, [isGlobal, data.globalHotspots, data.hotspotsByRoute, selectedRoute])

  const ranges = useMemo(() => metricRanges(rawPoints), [rawPoints])
  // Tope del slider extendido más allá del max real de los datos: el cliente
  // tiene que poder explorar umbrales por encima de cualquier valor presente.
  const filterMax = useMemo(() => {
    const out = {}
    for (const m of METRICS) {
      out[m.key] = filterSliderCeiling(m.key, ranges[m.key]?.max || 0)
    }
    return out
  }, [ranges])

  // Aplicar filtros de mínimo antes del scoring.
  const filteredPoints = useMemo(
    () =>
      rawPoints.filter((p) =>
        METRICS.every((m) => (p[m.key] ?? 0) >= (filters[m.key] || 0)),
      ),
    [rawPoints, filters],
  )

  const view = useMemo(
    () => buildMetricView(filteredPoints, { metricKey }),
    [filteredPoints, metricKey],
  )

  // Geometría: variantes de la ruta, o todas las principales (contexto) en global.
  const geometry = useMemo(() => {
    if (isGlobal) {
      return Object.values(data.routeGeometry || {})
        .map((variants) => variants.find((v) => v.isMain))
        .filter(Boolean)
        .map((v) => ({ coords: v.coords, isMain: false }))
    }
    return selectedRoute ? data.routeGeometry[selectedRoute] : null
  }, [isGlobal, data.routeGeometry, selectedRoute])

  const routeMeta = isGlobal ? null : data.routeMeta?.[selectedRoute]
  const currentMetricLabel =
    METRICS.find((m) => m.key === metricKey)?.label || 'la métrica'
  const pois = isGlobal
    ? data.allPois || EMPTY_POIS
    : data.poisByRoute?.[selectedRoute] || EMPTY_POIS

  const handleScopeChange = (s) => {
    setScope(s)
    setSelectedId(null)
    setFilters(DEFAULT_FILTERS)
  }
  const handleRouteChange = (route) => {
    setSelectedRoute(route)
    setSelectedId(null)
    setFilters(DEFAULT_FILTERS)
  }
  const handleFilterChange = (key, value) =>
    setFilters((f) => ({ ...f, [key]: value }))

  if (data.loading) {
    return (
      <div className={`app app-skeleton theme-${theme}`}>
        <div className="skeleton-panel">
          <div className="sk-brand" />
          <div className="sk-block" />
          <div className="sk-block" />
          <div className="sk-block short" />
        </div>
        <div className="skeleton-stage">
          <div className="spinner" />
          <p>Cargando datos de rutas y hotspots…</p>
        </div>
        <div className="skeleton-ranking">
          {Array.from({ length: 8 }).map((_, i) => (
            <div className="sk-row" key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (data.error) {
    return (
      <div className={`app app-error theme-${theme}`}>
        <div className="error-box">
          <p className="error">Error cargando los datos: {data.error}</p>
          <p className="error-hint">
            Comprueba que los CSV están en <code>public/data/</code> y que el
            servidor de desarrollo está activo.
          </p>
        </div>
      </div>
    )
  }

  const fitKey = isGlobal ? 'GLOBAL' : selectedRoute

  return (
    <div className={`app theme-${theme}`}>
      <ControlPanel
        routes={data.routes}
        scope={scope}
        onScopeChange={handleScopeChange}
        selectedRoute={selectedRoute}
        onRouteChange={handleRouteChange}
        theme={theme}
        onThemeChange={setTheme}
        metricKey={metricKey}
        onMetricChange={setMetricKey}
        topN={topN}
        onTopNChange={setTopN}
        showFuel={showFuel}
        onToggleFuel={setShowFuel}
        showIndustrial={showIndustrial}
        onToggleIndustrial={setShowIndustrial}
        hasPois={data.hasPois}
        filters={filters}
        filterMax={filterMax}
        onFilterChange={handleFilterChange}
        onResetFilters={() => setFilters(DEFAULT_FILTERS)}
        hasGeometry={data.hasGeometry}
      />

      <main className="stage">
        <MapView
          points={view}
          geometry={geometry}
          routeMeta={routeMeta}
          routeName={isGlobal ? null : selectedRoute}
          pois={pois}
          showFuel={showFuel}
          showIndustrial={showIndustrial}
          topN={topN}
          selectedId={selectedId}
          onSelect={setSelectedId}
          ranges={ranges}
          theme={theme}
          fitKey={fitKey}
        />

        <div className="route-badge">
          <span className="route-badge-label">
            {isGlobal ? 'Global' : 'Ruta'}
          </span>
          <span className="route-badge-name">
            {isGlobal
              ? `Todas las rutas · ${data.routes.length}`
              : selectedRoute}
          </span>
          <div className="route-badge-stats">
            <span className="route-badge-stat">
              <b>{view.length.toLocaleString('es-ES')}</b>
              <span className="route-badge-stat-label">hotspots</span>
            </span>
            {!isGlobal && routeMeta && (
              <span className="route-badge-stat">
                <b>{routeMeta.totalTraffic.toLocaleString('es-ES')}</b>
                <span className="route-badge-stat-label">vehículos en ruta</span>
              </span>
            )}
            {rawPoints.length !== view.length && (
              <span className="route-badge-stat-note">
                ({rawPoints.length} sin filtrar)
              </span>
            )}
          </div>
        </div>

        {/* Leyenda flotante sobre el mapa: qué son los círculos y qué dice el tamaño. */}
        <div className="map-legend">
          <div className="map-legend-row">
            <span className="ml-icon ml-circle" aria-hidden="true" />
            <span className="ml-text">Cada círculo es un hotspot</span>
          </div>
          <div className="map-legend-row">
            <span className="ml-icon ml-sizes" aria-hidden="true">
              <span className="ml-dot ml-dot-s" />
              <span className="ml-dot ml-dot-m" />
              <span className="ml-dot ml-dot-l" />
            </span>
            <span className="ml-text">
              Mayor <b>tamaño</b>, mayor <b>{currentMetricLabel}</b>
            </span>
          </div>
        </div>
      </main>

      <RankingList
        points={view}
        metricKey={metricKey}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
    </div>
  )
}
