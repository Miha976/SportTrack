import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { IS_LOCAL } from './services/repositories'
import { insideClaudeArtifact } from './services/local/store'
import './styles/global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA : hors ligne une fois installée (pas dans un artefact claude.ai, qui refuse les service workers).
if (IS_LOCAL && import.meta.env.PROD && 'serviceWorker' in navigator && !insideClaudeArtifact() && window.isSecureContext) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => undefined))
}
