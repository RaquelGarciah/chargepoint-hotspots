import { useEffect, useState } from 'react'
import {
  motion,
  useScroll,
  useTransform,
  useMotionTemplate,
} from 'framer-motion'
import Hero from './components/Hero.jsx'
import Dashboard from './Dashboard.jsx'

// Wrapper de sitio: hero a pantalla completa que se desvanece al hacer scroll y
// revela el dashboard. El hero es un overlay fijo; un spacer de 100vh crea el
// recorrido de scroll. El dashboard va en flujo normal (Leaflet dimensiona bien).
export default function App() {
  const { scrollY } = useScroll()
  const [vh, setVh] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 900,
  )

  useEffect(() => {
    const onResize = () => setVh(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const opacity = useTransform(scrollY, [0, vh * 0.85], [1, 0])
  const scale = useTransform(scrollY, [0, vh], [1, 1.08])
  const blurPx = useTransform(scrollY, [0, vh * 0.85], [0, 8])
  const filter = useMotionTemplate`blur(${blurPx}px)`
  const pointerEvents = useTransform(scrollY, (v) =>
    v > vh * 0.6 ? 'none' : 'auto',
  )

  return (
    <div className="site">
      <motion.section
        className="hero"
        style={{ opacity, scale, filter, pointerEvents }}
      >
        <Hero />
      </motion.section>

      <div className="hero-spacer" aria-hidden="true" />

      <Dashboard />
    </div>
  )
}
