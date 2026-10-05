import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// PWA: registra el service worker (public/sw.js) sólo en producción — en
// desarrollo (npm run dev) un service worker que cachea archivos confunde
// más de lo que ayuda, porque los cambios no se ven hasta limpiar la caché.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch((err) => console.warn('[pwa] No se pudo registrar el service worker:', err))
  })
}
