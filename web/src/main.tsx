import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/public-sans/latin-400.css'
import '@fontsource/public-sans/latin-500.css'
import '@fontsource/public-sans/latin-600.css'
import '@fontsource/public-sans/latin-700.css'
import '@fontsource/public-sans/latin-800.css'
import './index.css'
import { App } from './App'

const stored = localStorage.getItem('theme')
document.documentElement.setAttribute('data-theme', stored === 'dark' ? 'dark' : 'light')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').then((reg) => {
      // App abierta de antes (móvil en segundo plano): al volver, mira si hay versión nueva.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void reg.update()
      })
    })
  })
  // Un SW nuevo toma el control → recarga para usar la versión nueva. No en la
  // primera instalación (no había SW) ni si la página acaba de cargar desde la red
  // (ya es la nueva). ponytail: umbral de 10 s; si salta a mitad de un formulario
  // se pierde el borrador (solo tras desplegar y con la pestaña abierta).
  const hadController = !!navigator.serviceWorker.controller
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading || performance.now() < 10_000) return
    reloading = true
    location.reload()
  })
}
