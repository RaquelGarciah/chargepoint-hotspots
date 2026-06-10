import { useEffect, useRef } from 'react'

// Red de nodos minimalista en <canvas>: nodos a la deriva + líneas entre los
// cercanos. Discreto, acentos menta/cyan. Respeta prefers-reduced-motion.
export default function HeroBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let width = 0
    let height = 0
    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    let nodes = []
    let raf = 0
    let running = true

    const LINK_DIST = 150

    function resize() {
      width = canvas.clientWidth
      height = canvas.clientHeight
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      // Densidad proporcional al área (acotada).
      const count = Math.max(24, Math.min(54, Math.round((width * height) / 32000)))
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.6 + 0.8,
      }))
    }

    function draw() {
      ctx.clearRect(0, 0, width, height)

      // Líneas entre nodos cercanos.
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const d = Math.hypot(dx, dy)
          if (d < LINK_DIST) {
            const t = 1 - d / LINK_DIST
            ctx.strokeStyle = `rgba(0, 102, 255, ${t * 0.20})`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }

      // Nodos.
      for (const n of nodes) {
        n.x += n.vx
        n.y += n.vy
        if (n.x < 0 || n.x > width) n.vx *= -1
        if (n.y < 0 || n.y > height) n.vy *= -1
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)'
        ctx.fill()
      }

      if (running) raf = requestAnimationFrame(draw)
    }

    function drawStatic() {
      // Una sola pasada sin movimiento (reduced-motion).
      for (const n of nodes) {
        n.vx = 0
        n.vy = 0
      }
      draw()
    }

    resize()
    if (reduce) {
      running = false
      drawStatic()
    } else {
      draw()
    }

    const onResize = () => resize()
    const onVisibility = () => {
      if (document.hidden) {
        running = false
        cancelAnimationFrame(raf)
      } else if (!reduce) {
        running = true
        raf = requestAnimationFrame(draw)
      }
    }
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return <canvas ref={canvasRef} className="hero-canvas" aria-hidden="true" />
}
