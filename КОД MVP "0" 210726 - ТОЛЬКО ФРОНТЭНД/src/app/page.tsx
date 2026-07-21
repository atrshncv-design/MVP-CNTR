'use client'

/**
 * Root page proxies the pre-built Vite + React dashboard (located at
 * /app/index.html in the `public` folder) into the Next.js preview domain.
 *
 * The Vite app uses HashRouter, so all client-side routing (#/levels,
 * #/admin, ...) happens inside the iframe without server round-trips.
 */
export default function Home() {
  return (
    <iframe
      src="/app/index.html"
      title="ТЕХНОЗРЕЛОСТЬ — Платформа оценки технологий по ГОСТ Р 58048-2017"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        border: 'none',
        margin: 0,
        padding: 0,
        display: 'block',
      }}
      allow="fullscreen; clipboard-write; clipboard-read"
    />
  )
}
