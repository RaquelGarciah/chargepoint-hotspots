import { motion } from 'framer-motion'
import HeroBackground from './HeroBackground.jsx'

const HEADLINE = ['Where', 'to', 'put', 'chargepoints.']

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.12, delayChildren: 0.15 },
  },
}
const word = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
  },
}
const fade = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
}

export default function Hero() {
  const toDashboard = () =>
    window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })

  return (
    <div className="hero-inner">
      <HeroBackground />
      <div className="hero-grain" aria-hidden="true" />

      <motion.div
        className="hero-content"
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.p className="hero-eyebrow" variants={fade}>
          EV charging intelligence
        </motion.p>

        <h1 className="hero-title" aria-label={HEADLINE.join(' ')}>
          {HEADLINE.map((w, i) => (
            <motion.span
              key={i}
              variants={word}
              className={i === HEADLINE.length - 1 ? 'accent' : ''}
            >
              {w}
              {i < HEADLINE.length - 1 ? ' ' : ''}
            </motion.span>
          ))}
        </h1>

        <motion.p className="hero-subtitle" variants={fade}>
          Data-driven EV charging infrastructure placement for fleet operators.
        </motion.p>
      </motion.div>

      <motion.button
        className="hero-scroll"
        onClick={toDashboard}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.8 }}
        aria-label="Ir al panel"
      >
        <span>Explore the map</span>
        <svg className="chevron" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6 9l6 6 6-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </motion.button>
    </div>
  )
}
