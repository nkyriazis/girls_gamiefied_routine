import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/global.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// Register service worker for PWA
registerSW({
  immediate: true,
  onRegistered(r) {
    console.log('Service Worker registered:', r)
  },
  onOfflineReady() {
    console.log('App ready to work offline')
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
